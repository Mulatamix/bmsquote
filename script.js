const steps = [...document.querySelectorAll('.form-step')];
const stepButtons = [...document.querySelectorAll('.step')];
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const quoteForm = document.getElementById('quote-form');
const confirmation = document.getElementById('confirmation');
const errorEl = document.getElementById('form-error');
const equipmentType = document.getElementById('equipmentType');
const dynamicQuestions = document.getElementById('dynamic-questions');
const toggleInternalBtn = document.getElementById('toggleInternalBtn');
const technicianPanel = document.getElementById('technician-panel');

let currentStep = 1;

const dynamicMap = {
  'Ice machine': [
    'Do you need machine head only or machine head + bin?',
    'Is water supply and drain access available near the install location?',
    'If known, is the current unit air-cooled or water-cooled?'
  ],
  'Reach-in refrigerator': [
    'How many doors does the existing reach-in have?',
    'What is the approximate cabinet width?'
  ],
  'Condensing unit': [
    'Does this condensing unit serve a cooler or a freezer?',
    'Is the existing condensing unit remote/outdoor or indoor mounted?'
  ],
  'Walk-in cooler unit': [
    'Does the unit serve a cooler box or freezer box?',
    'Is this for condensing unit, evaporator, or both?'
  ],
  'Walk-in freezer unit': [
    'What box temperature setpoint is needed (if known)?',
    'Any defrost timing or heater requirements to match?'
  ],
  'HVAC equipment': [
    'If known, is this rooftop, split, package, or air handler?',
    'Does the replacement need to match existing curb/footprint exactly?'
  ]
};

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearError() {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function setStep(stepNumber) {
  currentStep = Math.max(1, Math.min(stepNumber, steps.length));

  steps.forEach((step) => {
    step.classList.toggle('is-active', Number(step.dataset.step) === currentStep);
  });

  stepButtons.forEach((stepButton) => {
    stepButton.classList.toggle('is-active', Number(stepButton.dataset.step) === currentStep);
  });

  prevBtn.classList.toggle('hidden', currentStep === 1);
  nextBtn.classList.toggle('hidden', currentStep === steps.length);
  submitBtn.classList.toggle('hidden', currentStep !== steps.length);
  clearError();
}

function validateContactMethod() {
  const phone = quoteForm.querySelector('input[name="phone"]').value.trim();
  const email = quoteForm.querySelector('input[name="email"]').value.trim();

  if (phone || email) {
    return true;
  }

  showError('Please provide at least one contact method: phone number or email address.');
  return false;
}

function validateCurrentStep() {
  const currentSection = steps.find((step) => Number(step.dataset.step) === currentStep);

  if (!currentSection) {
    return false;
  }

  const requiredFields = [...currentSection.querySelectorAll('[required]')];

  for (const field of requiredFields) {
    if (!field.value) {
      field.focus();
      showError('Please complete all required fields before continuing.');
      return false;
    }
  }

  if (currentStep === 1 && !validateContactMethod()) {
    return false;
  }

  if (currentStep === 5) {
    const photos = quoteForm.querySelector('#photos');

    if (!photos.files || photos.files.length === 0) {
      showError('Please upload at least one photo before continuing.');
      return false;
    }
  }

  clearError();
  return true;
}

// Validate every prerequisite, revealing the first incomplete step on failure.
function validateThrough(lastStep) {
  for (let step = 1; step <= lastStep; step += 1) {
    setStep(step);

    if (!validateCurrentStep()) {
      return false;
    }
  }

  return true;
}

stepButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = Number(button.dataset.step);

    if (target <= currentStep || validateThrough(target - 1)) {
      setStep(target);
    }
  });
});

prevBtn.addEventListener('click', () => setStep(currentStep - 1));

nextBtn.addEventListener('click', () => {
  const target = currentStep + 1;

  if (validateThrough(currentStep)) {
    setStep(target);
  }
});

equipmentType.addEventListener('change', () => {
  const selectedType = equipmentType.value;
  const prompts = dynamicMap[selectedType] || ['No special follow-ups for this category.'];

  dynamicQuestions.innerHTML = `
    <strong>Smart follow-up prompts:</strong>
    <ul>${prompts.map((prompt) => `<li>${prompt}</li>`).join('')}</ul>
  `;
});

toggleInternalBtn.addEventListener('click', () => {
  const showing = !technicianPanel.classList.contains('hidden');
  technicianPanel.classList.toggle('hidden', showing);
  toggleInternalBtn.textContent = showing ? 'Show Internal Checklist' : 'Hide Internal Checklist';
});

quoteForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateThrough(steps.length)) {
    return;
  }

  quoteForm.classList.add('hidden');
  confirmation.classList.remove('hidden');
  clearError();
});

setStep(1);
