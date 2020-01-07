import React, {useEffect, useRef, useState} from 'react';
import './App.css';
import {ClientGame} from './game/clientGame';

const App: React.FC<{width: number; height: number}> = props => {
  const client = useRef<ClientGame>(null);
  const [died, setDied] = useState(false);
  useEffect(() => {
    (client as React.MutableRefObject<ClientGame>).current = new ClientGame({
      onDied: () => {
        setDied(true);
      },
    });
  }, []);
  return (
    <div className="App">
      <canvas key={'canvas'} id={'game'} width={props.width} height={props.height} />
      {died && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            top: 0,
            color: 'white',
          }}
        >
          <span style={{fontSize: '3rem'}}>YOU DIED</span>
          <button
            onClick={() => {
              client.current!.rejoin();
              setDied(false);
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
