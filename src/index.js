import "./style.scss";
import {loadAnimation} from './threejs_experiment';

const initLog = () => {
  console.log(`Tag: ${VERSION}`);
  console.log(`Built on: ${BUILT}`);
}

window.addEventListener('DOMContentLoaded',() => {
  initLog();
  setTimeout(()=>{
    loadAnimation();
  }, 1200);
})


