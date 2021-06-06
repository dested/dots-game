import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';
// import {Bush} from './Bush';

ReactDOM.render(
  <>
    <App width={window.innerWidth} height={window.innerHeight} />
  </>,
  document.getElementById('root')
);
