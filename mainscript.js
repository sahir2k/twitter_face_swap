import * as faceapi from 'face-api.js';

let modelsLoaded = false; 
let targetDescriptor = null; 


const loadModels = async () => {
  const modelUrl = chrome.runtime.getURL('models/');
  await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
  await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
  await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);
  modelsLoaded = true;
  console.log('Models loaded successfully');
};


const loadTargetDescriptor = async () => {
  const img = await faceapi.fetchImage(chrome.runtime.getURL('target.webp'));
  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
  if (!detection) {
    console.error('No face detected in the target image.');
    return null;
  }
  return new faceapi.LabeledFaceDescriptors('Target', [detection.descriptor]);
};

(async () => {
  await loadModels();
  targetDescriptor = await loadTargetDescriptor();
  if (!targetDescriptor) {
    console.error('Failed to load target descriptor.');
    return;
  }
})();

const processImage = async (img) => {
  if (img.naturalHeight <= 50 || img.naturalWidth <= 50) {
    return; 
  }
  console.log('Processing image:', img.src);
  const targetDetected = await isTarget(img.src);
  console.log('Target detected:', targetDetected);

  if(targetDetected){
    const overlayImg = document.createElement('img');

    let mao1 = chrome.runtime.getURL('mao1.jpg');
    let mao2 = chrome.runtime.getURL('mao2.jpeg');
    let mao3 = chrome.runtime.getURL('mao3.jpeg');

    let maos = [mao1, mao2, mao3];

    const randomMao = maos[Math.floor(Math.random() * maos.length)];
    overlayImg.src = randomMao
    overlayImg.style.position = 'absolute';
    overlayImg.classList.add('overlay-applied');

    const rect = img.getBoundingClientRect();
    overlayImg.style.left = `${rect.left + window.scrollX}px`;
    overlayImg.style.top = `${rect.top + window.scrollY}px`;
    overlayImg.style.width = `${rect.width}px`;
    overlayImg.style.height = `${rect.height}px`;

    document.body.appendChild(overlayImg);
    img.style.opacity = '0'; // Hide the original img
    img.classList.add('overlay-applied');

    }
};

const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(async (entry) => {
    if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      await processImage(entry.target);
    }
  });
}, {
  rootMargin: '0px',
  threshold: 0.1
});

const setupObservers = () => {
  document.querySelectorAll('div[data-testid="tweetPhoto"] img').forEach(async img => {    imageObserver.observe(img);
  });

  // Observe new images added to the DOM
  const mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.tagName === 'IMG') {
          imageObserver.observe(node);
        }
      });
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
};

const intervalId = setInterval(() => {
  if (modelsLoaded && targetDescriptor) {
    setupObservers();
    clearInterval(intervalId);
  }
}, 100); // Check every 100ms

const isTarget = async (src) => {
  console.log('isTarget:');
  const img = await faceapi.fetchImage(src);
  const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptors();
  if (!detections.length) {
    return false;
  }
  const faceMatcher = new faceapi.FaceMatcher(targetDescriptor, 0.6);
  const bestMatch = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
  return bestMatch.some(result => result.label === 'Target');
};
