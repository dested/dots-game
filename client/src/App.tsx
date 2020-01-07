import React, {useEffect} from 'react';
import {ServerGame} from '../../server/src/game/serverGame';
import './App.css';
import {ClientGame} from './game/clientGame';
import {clientGames, setServerGame} from './utils/fake-socket';

const App: React.FC<{id: string; width: number; height: number}> = props => {
  useEffect(() => {
    clientGames.push(new ClientGame(props.id));
  }, []);
  return (
    <div className="App">
      <canvas id={'game' + props.id} width={props.width} height={props.height} />
    </div>
  );
};

export default App;

const serverGame = new ServerGame();
serverGame.init();
setServerGame(serverGame);
