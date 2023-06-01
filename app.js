import * as THREE from "three";
import * as Papa from "papaparse";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const resolution = 256;

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
camera.position.set( .3, 4, 4 );
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
    let mean_motion = parseFloat(results['MEAN_MOTION']);
    let eccentricity = parseFloat(results['ECCENTRICITY']);
    let INCLINATION = parseFloat(results['INCLINATION']);
    let RA_OF_ASC_NODE = parseFloat(results['RA_OF_ASC_NODE']);
    let orbit = orbitMaker(mean_motion, eccentricity, INCLINATION, RA_OF_ASC_NODE);
    scene.add(orbit);
}


let activeData = [];
let satcatData = [];

function parseCSVData(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            complete: function(results) {
                resolve(results.data);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

async function updateData() {
    try {
        activeData = await parseCSVData("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv");
        satcatData = await parseCSVData("https://celestrak.com/pub/satcat.csv");
    } catch (err) {
        console.error(err);
    }
}

async function readDataFromDisk() {
    try {
        activeData = await parseCSVData("data/active.csv");
        satcatData = await parseCSVData("data/satcat.csv");
    } catch (err) {
        console.error(err);
    }
    satcatData = satcatData.filter(item => {
        return activeData.find(activeItem => activeItem.NORAD_CAT_ID === item.NORAD_CAT_ID);
    }
    );
}

function filterDataAndDraw() {
    let filteredData = satcatData.filter(item => {
        return item.OBJECT_TYPE === 'PAY' &&
            item.OBJECT_NAME.includes('COM') &&
            new Date(item.LAUNCH_DATE).getTime() < new Date(1999, 0, 1).getTime()
    });
    filteredData.forEach(item => {
        let activeItem = activeData.find(activeItem => activeItem.NORAD_CAT_ID === item.NORAD_CAT_ID);
        if (activeItem) {
            drawOrbitFromData(activeItem);
        }
    }
    );
}

readDataFromDisk().then(filterDataAndDraw).catch(err => console.error(err));

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    earth.rotation.y += 0.0005;
	requestAnimationFrame( animate );
    let distance = camera.position.length();
    controls.rotateSpeed = distance * 0.3;
    controls.update();
	renderer.render( scene, camera );
    onWindowResize();
}

animate();