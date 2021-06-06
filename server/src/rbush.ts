/* tslint:disable */

import quickselect from 'quickselect';

export type BBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
export type RNode<T> = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  children?: RNode<T>[];
  leaf?: boolean;
  height?: number;

  item: T;
};

export class RBush<T> {
  private _maxEntries: number;
  private _minEntries: number;
  constructor(maxEntries = 9) {
    // max entries in a node is 9 by default; min node fill is 40% for best performance
    this._maxEntries = Math.max(4, maxEntries);
    this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
    this.clear();
  }

  data: RNode<T>;

  all() {
    return this._all(this.data, []);
  }

  search(bbox: BBox) {
    let node = this.data;
    const result: RNode<T>[] = [];

    if (!intersects(bbox, node)) return result;

    const toBBox = this.toBBox;
    const nodesToSearch = [];

    while (node) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childBBox = node.leaf ? toBBox(child) : child;

        if (intersects(bbox, childBBox)) {
          if (node.leaf) result.push(child);
          else if (contains(bbox, childBBox)) this._all(child, result);
          else nodesToSearch.push(child);
        }
      }
      node = nodesToSearch.pop();
    }

    return result;
  }

  collides(bbox: BBox) {
    let node = this.data;

    if (!intersects(bbox, node)) return false;

    const nodesToSearch = [];
    while (node) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childBBox = node.leaf ? this.toBBox(child) : child;

        if (intersects(bbox, childBBox)) {
          if (node.leaf || contains(bbox, childBBox)) return true;
          nodesToSearch.push(child);
        }
      }
      node = nodesToSearch.pop();
    }

    return false;
  }

  load(data: RNode<T>[]) {
    if (!(data && data.length)) return this;

    if (data.length < this._minEntries) {
      for (let i = 0; i < data.length; i++) {
        this.insert(data[i]);
      }
      return this;
    }

    // recursively build the tree with the given data from scratch using OMT algorithm
    let node = this._build(data.slice(), 0, data.length - 1, 0);

    if (!this.data.children.length) {
      // save as is if tree is empty
      this.data = node;
    } else if (this.data.height === node.height) {
      // split root if trees have the same height
      this._splitRoot(this.data, node);
    } else {
      if (this.data.height < node.height) {
        // swap trees if inserted one is bigger
        const tmpNode = this.data;
        this.data = node;
        node = tmpNode;
      }

      // insert the small tree into the large tree at appropriate level
      this._insert(node, this.data.height - node.height - 1, true);
    }

    return this;
  }

  insert(item: RNode<T>) {
    if (item) this._insert(item, this.data.height - 1);
    return this;
  }

  clear() {
    this.data = createNode([]);
    return this;
  }

  /*
  public update(item: RNode<T>, bounds: BBox): this {
    const parent: RNode<T> = item.parentNode;

    if (
      bounds.minX < parent.minX || bounds.maxX > parent.maxX ||
      bounds.minY < parent.minY || bounds.maxY > parent.maxY
    ) {
      this.remove(item);

      item.minX = bounds.minX;
      item.maxX = bounds.maxX;
      item.minY = bounds.minY;
      item.maxY = bounds.maxY;

      this.insert(item);
    } else {
      item.minX = bounds.minX;
      item.maxX = bounds.maxX;
      item.minY = bounds.minY;
      item.maxY = bounds.maxY;
    }

    return this;
  }
*/
  remove(item: RNode<T>, equalsFn?: (left: BBox, right: BBox) => boolean) {
    if (!item) return this;

    let node = this.data;
    const bbox = this.toBBox(item);
    const path = [];
    const indexes: number[] = [];
    let i, parent, goingUp;

    // depth-first iterative tree traversal
    while (node || path.length) {
      if (!node) {
        // go up
        node = path.pop();
        parent = path[path.length - 1];
        i = indexes.pop();
        goingUp = true;
      }

      if (node.leaf) {
        // check current node
        const index = findItem(item, node.children, equalsFn);

        if (index !== -1) {
          // item found, remove the item and condense tree upwards
          node.children.splice(index, 1);
          path.push(node);
          this._condense(path);
          return this;
        }
      }

      if (!goingUp && !node.leaf && contains(node, bbox)) {
        // go down
        path.push(node);
        indexes.push(i);
        i = 0;
        parent = node;
        node = node.children[0];
      } else if (parent) {
        // go right
        i++;
        node = parent.children[i];
        goingUp = false;
      } else node = null; // nothing found
    }

    return this;
  }

  toBBox(item: BBox) {
    return item;
  }

  compareMinX(a: BBox, b: BBox) {
    return a.minX - b.minX;
  }
  compareMinY(a: BBox, b: BBox) {
    return a.minY - b.minY;
  }

  toJSON() {
    return this.data;
  }

  fromJSON(data: RNode<T>) {
    this.data = data;
    return this;
  }

  private _all(node: RNode<T>, result: RNode<T>[]) {
    const nodesToSearch = [];
    while (node) {
      if (node.leaf) result.push(...node.children);
      else nodesToSearch.push(...node.children);

      node = nodesToSearch.pop();
    }
    return result;
  }

  private _build(items: RNode<T>[], left: number, right: number, height: number): RNode<T> {
    const N = right - left + 1;
    let M = this._maxEntries;
    let node;

    if (N <= M) {
      // reached leaf level; return leaf
      node = createNode(items.slice(left, right + 1));
      calcBBox(node, this.toBBox);
      return node;
    }

    if (!height) {
      // target height of the bulk-loaded tree
      height = Math.ceil(Math.log(N) / Math.log(M));

      // target number of root entries to maximize storage utilization
      M = Math.ceil(N / Math.pow(M, height - 1));
    }

    node = createNode<T>([]);
    node.leaf = false;
    node.height = height;

    // split the items into M mostly square tiles

    const N2 = Math.ceil(N / M);
    const N1 = N2 * Math.ceil(Math.sqrt(M));

    multiSelect(items, left, right, N1, this.compareMinX);

    for (let i = left; i <= right; i += N1) {
      const right2 = Math.min(i + N1 - 1, right);

      multiSelect(items, i, right2, N2, this.compareMinY);

      for (let j = i; j <= right2; j += N2) {
        const right3 = Math.min(j + N2 - 1, right2);

        // pack each entry recursively
        node.children.push(this._build(items, j, right3, height - 1));
      }
    }

    calcBBox(node, this.toBBox);

    return node;
  }

  private _chooseSubtree(bbox: BBox, node: RNode<T>, level: number, path: BBox[]) {
    while (true) {
      path.push(node);

      if (node.leaf || path.length - 1 === level) break;

      let minArea = Infinity;
      let minEnlargement = Infinity;
      let targetNode;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const area = bboxArea(child);
        const enlargement = enlargedArea(bbox, child) - area;

        // choose entry with the least area enlargement
        if (enlargement < minEnlargement) {
          minEnlargement = enlargement;
          minArea = area < minArea ? area : minArea;
          targetNode = child;
        } else if (enlargement === minEnlargement) {
          // otherwise choose one with the smallest area
          if (area < minArea) {
            minArea = area;
            targetNode = child;
          }
        }
      }

      node = targetNode || node.children[0];
    }

    return node;
  }

  private _insert(item: RNode<T>, level: number, isNode?: boolean) {
    const bbox = isNode ? item : this.toBBox(item);
    const insertPath: RNode<T>[] = [];

    // find the best node for accommodating the item, saving all nodes along the path too
    const node = this._chooseSubtree(bbox, this.data, level, insertPath);

    // put the item into the node
    node.children.push(item);
    extend(node, bbox);

    // split on node overflow; propagate upwards if necessary
    while (level >= 0) {
      if (insertPath[level].children.length > this._maxEntries) {
        this._split(insertPath, level);
        level--;
      } else break;
    }

    // adjust bboxes along the insertion path
    this._adjustParentBBoxes(bbox, insertPath, level);
  }

  // split overflowed node into two
  private _split(insertPath: RNode<T>[], level: number) {
    const node = insertPath[level];
    const M = node.children.length;
    const m = this._minEntries;

    this._chooseSplitAxis(node, m, M);

    const splitIndex = this._chooseSplitIndex(node, m, M);

    const newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex));
    newNode.height = node.height;
    newNode.leaf = node.leaf;

    calcBBox(node, this.toBBox);
    calcBBox(newNode, this.toBBox);

    if (level) insertPath[level - 1].children.push(newNode);
    else this._splitRoot(node, newNode);
  }

  private _splitRoot(node: RNode<T>, newNode: RNode<T>) {
    // split root node
    this.data = createNode([node, newNode]);
    this.data.height = node.height + 1;
    this.data.leaf = false;
    calcBBox(this.data, this.toBBox);
  }

  private _chooseSplitIndex(node: RNode<T>, m: number, M: number) {
    let index;
    let minOverlap = Infinity;
    let minArea = Infinity;

    for (let i = m; i <= M - m; i++) {
      const bbox1 = distBBox(node, 0, i, this.toBBox);
      const bbox2 = distBBox(node, i, M, this.toBBox);

      const overlap = intersectionArea(bbox1, bbox2);
      const area = bboxArea(bbox1) + bboxArea(bbox2);

      // choose distribution with minimum overlap
      if (overlap < minOverlap) {
        minOverlap = overlap;
        index = i;

        minArea = area < minArea ? area : minArea;
      } else if (overlap === minOverlap) {
        // otherwise choose distribution with minimum area
        if (area < minArea) {
          minArea = area;
          index = i;
        }
      }
    }

    return index || M - m;
  }

  // sorts node children by the best axis for split
  private _chooseSplitAxis(node: RNode<T>, m: number, M: number) {
    const compareMinX = node.leaf ? this.compareMinX : compareNodeMinX;
    const compareMinY = node.leaf ? this.compareMinY : compareNodeMinY;
    const xMargin = this._allDistMargin(node, m, M, compareMinX);
    const yMargin = this._allDistMargin(node, m, M, compareMinY);

    // if total distributions margin value is minimal for x, sort by minX,
    // otherwise it's already sorted by minY
    if (xMargin < yMargin) node.children.sort(compareMinX);
  }

  // total margin of all possible split distributions where each node is at least m full
  private _allDistMargin(node: RNode<T>, m: number, M: number, compare: (left: RNode<T>, right: RNode<T>) => number) {
    node.children.sort(compare);

    const toBBox = this.toBBox;
    const leftBBox = distBBox(node, 0, m, toBBox);
    const rightBBox = distBBox(node, M - m, M, toBBox);
    let margin = bboxMargin(leftBBox) + bboxMargin(rightBBox);

    for (let i = m; i < M - m; i++) {
      const child = node.children[i];
      extend(leftBBox, node.leaf ? toBBox(child) : child);
      margin += bboxMargin(leftBBox);
    }

    for (let i = M - m - 1; i >= m; i--) {
      const child = node.children[i];
      extend(rightBBox, node.leaf ? toBBox(child) : child);
      margin += bboxMargin(rightBBox);
    }

    return margin;
  }

  private _adjustParentBBoxes(bbox: BBox, path: RNode<T>[], level: number) {
    // adjust bboxes along the given tree path
    for (let i = level; i >= 0; i--) {
      extend(path[i], bbox);
    }
  }

  private _condense(path: RNode<T>[]) {
    // go through the path, removing empty nodes and updating bboxes
    for (let i = path.length - 1, siblings; i >= 0; i--) {
      if (path[i].children.length === 0) {
        if (i > 0) {
          siblings = path[i - 1].children;
          siblings.splice(siblings.indexOf(path[i]), 1);
        } else this.clear();
      } else calcBBox(path[i], this.toBBox);
    }
  }
}

function findItem<T>(item: RNode<T>, items: RNode<T>[], equalsFn: (left: BBox, right: BBox) => boolean) {
  if (!equalsFn) return items.indexOf(item);

  for (let i = 0; i < items.length; i++) {
    if (equalsFn(item, items[i])) return i;
  }
  return -1;
}

// calculate node's bbox from bboxes of its children
function calcBBox<T>(node: RNode<T>, toBBox: (node: RNode<T>) => BBox) {
  distBBox(node, 0, node.children.length, toBBox, node);
}

// min bounding rectangle of node children from k to p-1
function distBBox<T>(node: RNode<T>, k: number, p: number, toBBox: (node: RNode<T>) => BBox, destNode?: RNode<T>) {
  if (!destNode) destNode = createNode<T>(null);
  destNode.minX = Infinity;
  destNode.minY = Infinity;
  destNode.maxX = -Infinity;
  destNode.maxY = -Infinity;

  for (let i = k; i < p; i++) {
    const child = node.children[i];
    extend(destNode, node.leaf ? toBBox(child) : child);
  }

  return destNode;
}

function extend(a: BBox, b: BBox) {
  a.minX = Math.min(a.minX, b.minX);
  a.minY = Math.min(a.minY, b.minY);
  a.maxX = Math.max(a.maxX, b.maxX);
  a.maxY = Math.max(a.maxY, b.maxY);
  return a;
}

function compareNodeMinX(a: BBox, b: BBox) {
  return a.minX - b.minX;
}
function compareNodeMinY(a: BBox, b: BBox) {
  return a.minY - b.minY;
}

function bboxArea(a: BBox) {
  return (a.maxX - a.minX) * (a.maxY - a.minY);
}
function bboxMargin(a: BBox) {
  return a.maxX - a.minX + (a.maxY - a.minY);
}

function enlargedArea(a: BBox, b: BBox) {
  return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) * (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
}

function intersectionArea(a: BBox, b: BBox) {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);

  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

function contains(a: BBox, b: BBox) {
  return a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY;
}

function intersects(a: BBox, b: BBox) {
  return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY;
}

function createNode<T>(children: RNode<T>[]): RNode<T> {
  return {
    children,
    height: 1,
    leaf: true,
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    item: null,
  };
}

// sort an array so that items come in groups of n unsorted items, with groups sorted between each other;
// combines selection algorithm with binary divide & conquer approach

function multiSelect<T>(arr: T[], left: number, right: number, n: number, compare: (left: T, right: T) => number) {
  const stack = [left, right];

  while (stack.length) {
    right = stack.pop();
    left = stack.pop();

    if (right - left <= n) continue;

    const mid = left + Math.ceil((right - left) / n / 2) * n;
    quickselect(arr, mid, left, right, compare);

    stack.push(left, mid, mid, right);
  }
}
