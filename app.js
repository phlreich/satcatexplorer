import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const resolution = 128;

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( .3, 2, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 100;
controls.minDistance = 1.2;

const earthradius = 1;
const scaleFactor = earthradius / 6371;
const geometry1 = new THREE.SphereGeometry(earthradius, resolution, resolution);
const textureLoader = new THREE.TextureLoader();
const earth_texture = textureLoader.load("/8081_earthmap10k.webp");
earth_texture.colorSpace = THREE.SRGBColorSpace; // use srgb color space
const material1 = new THREE.MeshBasicMaterial( { map: earth_texture } );
const earth = new THREE.Mesh( geometry1, material1 );
scene.add( earth );

// add the moon
const geometry2 = new THREE.SphereGeometry(1737.4 * scaleFactor, resolution, resolution);
const moon_texture = textureLoader.load("/lroc_color_poles_4k.webp");
moon_texture.colorSpace = THREE.SRGBColorSpace; // use srgb color space
const material2 = new THREE.MeshBasicMaterial( { map: moon_texture } );
const moon = new THREE.Mesh( geometry2, material2 );
moon.position.set(362600 * scaleFactor, 0, 0);
scene.add( moon );

// add button to switch the camera to the moon
const button2 = document.createElement('button');
button2.innerHTML = 'Switch to moon';
button2.style.position = 'absolute';
button2.style.top = '10px';
button2.style.left = '10px';
button2.style.zIndex = 1;
button2.onclick = () => {
    const cameraDistance = camera.position.distanceTo(controls.target);
    const cameraDirection = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    let minDistance;

    if (controls.target.x === 0) {
        controls.target.set(362600 * scaleFactor, 0, 0);
        button2.innerHTML = 'Switch to earth';
        minDistance = 1.2; // Update with your preferred minimum distance for earth
    } else {
        controls.target.set(0, 0, 0);
        button2.innerHTML = 'Switch to moon';
        minDistance = 0.3; // Update with your preferred minimum distance for moon
    }

    // Update camera position to keep same distance and direction
    camera.position.copy(cameraDirection.multiplyScalar(cameraDistance).add(controls.target));
};


document.body.appendChild(button2);


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

function drawOrbitFromData(results) {
    let mean_motion = parseFloat(results['mean_motion']);
    let eccentricity = parseFloat(results['eccentricity']);
    let INCLINATION = parseFloat(results['inclination']);
    let RA_OF_ASC_NODE = parseFloat(results['ra_of_asc_node']);
    let mu = 398600.4418; // Earth's gravitational parameter, in km^3/s^2
    let n = mean_motion * 2 * Math.PI / (24*3600); // convert from rev/day to rad/s
    let semiMajorAxis = Math.pow(mu / (n * n), 1 / 3);
    let semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
    let orbit = orbitShapeMaker(semiMajorAxis, semiMinorAxis);
    let points = orbit.getPoints(resolution);
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    // see if field color exists when not make it red
    let color = results['color'] ? results['color'] : 0xff0000;
    let material = new THREE.LineBasicMaterial({color: color});
    let ellipse = new THREE.Line(geometry, material);
    let x = THREE.MathUtils.degToRad(90);
    let y = THREE.MathUtils.degToRad(RA_OF_ASC_NODE);
    let z = THREE.MathUtils.degToRad(INCLINATION);
    ellipse.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), x); // rotation order is important
    ellipse.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), z);
    ellipse.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), y);
    scene.add(ellipse);
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
let demoText = "SELECT * FROM satcatdata_viable ORDER BY launch_date ASC LIMIT 10";
let textIndex = 0;

function typeText() {
  if (textIndex < demoText.length) {
    // expand the container and show the button when the first character is typed
    button.disabled = true;
    input.disabled = true;
    if (textIndex === 17) {
      expandContainer();
      // nevermind button.style.visibility = "visible";
      // TODO remove the button entirely
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
    let server_url = '/api/search?q=';
    if (process.env.NODE_ENV === 'development') {
        server_url = 'http://localhost:5730' + server_url;
    }
    fetch(server_url + encodeURIComponent(input.value))
    .then(response => response.json())
    .then(data => {
        data.forEach(drawOrbitFromData);
    });
    // moon orbit
    // drawOrbitFromData({'mean_motion': 1/27.322, 'eccentricity': 0.0549, 'inclination': 5.145, 'ra_of_asc_node': 0, 'color': 'blue'});
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
    earth.rotation.y += 0.1001;
	requestAnimationFrame( animate );
    controls.update();
	renderer.render( scene, camera );
    onWindowResize();
}

animate();

// type the demo text after a delay
setTimeout(typeText, 2000);