import * as THREE from './build/three.module.js';
import { ControllerHelper } from './jsm/webxr/ControllerHelper.js';
import { VRButton } from './jsm/webxr/VRButton.js';

let camera, scene, renderer, light, testCube, playerRig, controllers;
let handPoints, currentStroke, capturingGesture, recognizer, lastGestureUpdate, projectedPoints;

const gestureSampleRate = 1;

init();

function init() {
  let container = document.createElement('div');
  document.body.appendChild(container);

  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.xr.enabled = true;

  scene = new THREE.Scene();

  light = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  scene.add(light);

  // The player rig acts as a container for our camera and controls, allowing us to easily move the player
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  playerRig = new THREE.Group();
  playerRig.position.set(0, 0, 0);
  playerRig.add(camera);
  scene.add(playerRig);

  // testCube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
  // testCube.position.z -= 1.5;
  // testCube.position.y += 0.5;
  // scene.add(testCube);

  setupControllers();

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('unload', closeSession);

  // Switch these lines to use the button or auto-session request
  // document.body.appendChild(VRButton.createButton(renderer));
  requestSession();
}

function startGesture() {
  capturingGesture = true;
  handPoints = {};
  projectedPoints = {};
  currentStroke = 0;
  for (const hand in controllers.hands) {
    handPoints[hand] = [];
    projectedPoints = [];
  }
}

function updateGesture() {
  if (!lastGestureUpdate || Date.now() - lastGestureUpdate >= gestureSampleRate) {
    lastGestureUpdate = Date.now();
  } else return;

  for (const hand in controllers.hands) {
    handPoints[hand].push([
      controllers.hands[hand].model.position.x,
      controllers.hands[hand].model.position.y,
      controllers.hands[hand].model.position.z
    ]);
  }
}

function endGesture() {
  capturingGesture = false;
  recognizeGesture();
}

function recognizeGesture() {
  // Create a plane to project to
  // let plane = new THREE.Plane().setFromCoplanarPoints(playerRig.position.x,playerRig.position.y,playerRig.position.z);
  // projectedPoints = [];

  // for (const hand in handPoints) {
  //   for (let i = 0; i < handPoints[hand].length; i++) {
  //     var point = new THREE.Vector3(handPoints[hand][i][0],handPoints[hand][i][1],handPoints[hand][i][2]);
  //     var projectedPoint = plane.projectPoint();
  //     projectedPoints.push(new Point(Number(projectedPoint.x), Number(projectedPoint.y), 0));
  //   }
  // }

  for (const hand in handPoints) {
    for (let i = 0; i < handPoints[hand].length; i++) {
      const projectedPoint = new THREE.Vector3();
      projectedPoint.fromArray(handPoints[hand][i]);
      projectedPoint.project(camera);
      projectedPoints.push(new Point(Number(projectedPoint.x), Number(projectedPoint.y), 0));

      console.log('Hand:', hand);
      if (hand === 'right') {
        let cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        cube.position.x = projectedPoint.x;
        cube.position.y = projectedPoint.z;
        cube.position.z = -2;
        scene.add(cube);
      }
    }
  }

  if (typeof recognizer === 'undefined') recognizer = new PDollarRecognizer();
  let result = recognizer.Recognize(projectedPoints);
  console.log(projectedPoints);
  console.log(result);
}

function setupControllers() {
  // Save the controllers and grips and add them to the player rig
  document.addEventListener('controllerHelperReady', function (ev) {
    controllers = ev.detail;
    console.log(`Found ${Object.keys(controllers.hands).length} ${controllers.type} controller(s)`);
    for (const hand in controllers.hands) {
      if (!controllers.hands.hasOwnProperty(hand)) continue;
      console.log(`Setup ${hand} hand controller`);
      playerRig.add(controllers.hands[hand].model);
      playerRig.add(controllers.hands[hand].grip);
    }
    console.log(controllers);
  });

  document.addEventListener('controllerHelperStateChange', function (ev) {
    console.log('Controller State Changed:', ev.detail);
  });

  document.addEventListener('controllerHelperValueChange', function (ev) {
    console.log('Controller Value Changed:', ev.detail);
    if (!capturingGesture && ev.detail.value === 1) startGesture();
    else if (capturingGesture && ev.detail.value === 0) endGesture();
  });

  document.addEventListener('controllerHelperAxisChange', function (ev) {
    console.log('Controller Axis Changed:', ev.detail);
  });

  document.addEventListener('controllerHelperChange', function () {
    console.log('Controller Changed:', ControllerHelper.state);
  });
}

function requestSession() {
  navigator.xr.isSessionSupported('immersive-vr').then(function (supported) {
    let options = { optionalFeatures: ['local-floor', 'bounded-floor'] };
    navigator.xr.requestSession('immersive-vr', options).then(onSessionStarted);
  });
}

function onSessionStarted(session) {
  renderer.xr.setSession(session);
  renderer.setAnimationLoop(render);
  ControllerHelper.setupControllers(renderer);
}

async function closeSession() {
  await renderer.xr.getSession().end();
}

function render() {
  if (renderer.xr.isPresenting) ControllerHelper.updateControls();
  if (typeof controllers !== 'undefined') {
    if (capturingGesture) updateGesture();
    // console.log(controllers.hands['left'].model.position.x);
  }
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

