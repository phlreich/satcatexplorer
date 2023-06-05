import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const resolution = 128;

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const earthradius = 1;
const scaleFactor = earthradius / 6371;
const geometry1 = new THREE.SphereGeometry(earthradius, resolution, resolution);
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load("/8081_earthmap10k.webp");
texture.colorSpace = THREE.SRGBColorSpace; // use srgb color space
const material1 = new THREE.MeshBasicMaterial( { map: texture } );
const earth = new THREE.Mesh( geometry1, material1 );
scene.add( earth );

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( .3, 2, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 100;
controls.minDistance = 1.2;

function orbitShapeMaker(semiMajorAxis, semiMinorAxis) {
    semiMajorAxis *= scaleFactor;
    semiMinorAxis *= scaleFactor;
    return new THREE.EllipseCurve(
        Math.sqrt(semiMajorAxis**2 - semiMinorAxis**2), 0,        // center
        semiMajorAxis, semiMinorAxis,                             // xRadius, yRadius
        0,  2 * Math.PI,                                          // aStartAngle, aEndAngle
        false,                                                    // aClockwise
        0,                                                        // aRotation
    );
}

function orbitMaker(mean_motion, eccentricity, INCLINATION, RA_OF_ASC_NODE) {
    let mu = 398600.4418; // Earth's gravitational parameter, in km^3/s^2
    let n = mean_motion * 2 * Math.PI / (24*3600); // convert from rev/day to rad/s
    let semiMajorAxis = Math.pow(mu / (n * n), 1 / 3);
    let semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
    let orbit = orbitShapeMaker(semiMajorAxis, semiMinorAxis);
    let points = orbit.getPoints(resolution);
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({color: 0xff0000});
    let ellipse = new THREE.Line(geometry, material);
    let x = THREE.MathUtils.degToRad(90);
    let y = THREE.MathUtils.degToRad(RA_OF_ASC_NODE);
    let z = THREE.MathUtils.degToRad(INCLINATION);
    ellipse.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), x); // rotation order is important
    ellipse.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), z);
    ellipse.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), y);
    return ellipse;
}

function drawOrbitFromData(results) {
    let mean_motion = parseFloat(results['mean_motion']);
    let eccentricity = parseFloat(results['eccentricity']);
    let INCLINATION = parseFloat(results['inclination']);
    let RA_OF_ASC_NODE = parseFloat(results['ra_of_asc_node']);
    let orbit = orbitMaker(mean_motion, eccentricity, INCLINATION, RA_OF_ASC_NODE);
    scene.add(orbit);
}

// create a container for the input field and button
let container = document.createElement("div");
container.className = "search-container";
document.body.appendChild(container);

// add a text input field in the container
let input = document.createElement("input");
input.type = "text";
input.className = "input-field";
container.appendChild(input);

// add a button next to the text input field
let button = document.createElement("button");
button.innerHTML = "✈";  // Unicode for paper airplane
button.className = "button-search";
container.appendChild(button);

// function to expand container
function expandContainer() {
  container.style.width = "400px";
}

// dynamically adjust container width when the input field is focused or unfocused
input.addEventListener('focus', expandContainer);
input.addEventListener('blur', function() {
  if (input.value === "") {
    container.style.width = "200px";
  }
});

// simulate typing text
let demoText = "Computer! Show me the ten oldest satellites.";
let textIndex = 0;

function typeText() {
  if (textIndex < demoText.length) {
    // expand the container and show the button when the first character is typed
    button.disabled = true;
    input.disabled = true;
    if (textIndex === 17) {
      expandContainer();
      button.style.visibility = "visible";
    }
    
    input.value += demoText.charAt(textIndex);
    textIndex++;
    setTimeout(typeText, 80);  // adjust the delay as needed
  } else {
    button.disabled = false;
    input.disabled = false;
    // wait for 2 seconds and then click the button
    setTimeout(function() {
        button.click();
        }
    , 1300);
  }
}

button.addEventListener("click", function() {
    console.log(input.value);
    // clear orbits
    for(let i = scene.children.length - 1; i >= 0; i--){
        let child = scene.children[i];
        if (child.type == "Line") {
            scene.remove(child);
        }
    }

    // update the scene
    scene.traverse(function (node) {
        if (node instanceof THREE.Line) {
            node.geometry.dispose();
            node.material.dispose();
        }
    });
    // send request to server
    fetch('http://192.168.2.127:5730/api/search?q=' + encodeURIComponent(input.value))
    .then(response => response.json())
    .then(data => {
        data.forEach(drawOrbitFromData);
    });
    input.value = "";
    container.style.width = "200px";
    button.style.visibility = "hidden";
});

input.addEventListener("keyup", function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        button.click();
    }
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    earth.rotation.y += 0.0001;
	requestAnimationFrame( animate );
    let distance = camera.position.length();
    controls.rotateSpeed = distance * 0.3;
    controls.update();
	renderer.render( scene, camera );
    onWindowResize();
}

animate();

// type the demo text after a delay
setTimeout(typeText, 100);  // adjust the delay as needed