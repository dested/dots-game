import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';

ReactDOM.render(
  <>
    <App id={'a'} width={window.innerWidth} height={window.innerHeight / 2} />
  </>,
  document.getElementById('root')
);
