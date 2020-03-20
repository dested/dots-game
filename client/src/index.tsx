import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';

ReactDOM.render(
  <>
    <App width={window.innerWidth} height={window.innerHeight} />
  </>,
  document.getElementById('root')
);
