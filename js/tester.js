let cueData = null;
let questions = [];
let questionIndex = 0;
let questionStates = [];
let activeFeedbackCleanup = null;

function applyFeedback(choice, question) {
  if (activeFeedbackCleanup) {
    activeFeedbackCleanup();
    activeFeedbackCleanup = null;
  }

  switch (choice.feedbackType) {
    case 'highlight':
      activeFeedbackCleanup = applyHighlightFeedback(choice.targets);
      break;

    case 'identify-pos':
      activeFeedbackCleanup = applyIdentifyPosFeedback(choice.targets);
      break;

    default:
      console.warn(`Unknown feedback type: ${choice.feedbackType}`);
  }
}

function applyIdentifyPosFeedback(targets) {
  const createdPosTargets = [];
  const groupedTargets = new Map();

  targets.forEach(target => {
    let sourceElement;

    if (target.source === 'passage') {
      sourceElement = document.querySelector('.passage');
    } else if (target.source === 'question') {
      sourceElement = document.querySelector('.question-text');
    } else if (target.source === 'choice') {
      sourceElement = document.querySelector(
        `.choice[data-choice="${target.choice}"] .choice-text`
      );
    }

    if (!sourceElement) return;

    if (!groupedTargets.has(sourceElement)) {
      groupedTargets.set(sourceElement, []);
    }

    groupedTargets.get(sourceElement).push(target);
  });

  groupedTargets.forEach((elementTargets, sourceElement) => {
    let html = sourceElement.textContent;

    const targetsWithPositions = elementTargets
      .map(target => ({
        ...target,
        index: html.indexOf(target.text)
      }))
      .filter(target => target.index !== -1)
      .sort((a, b) => b.index - a.index);

    targetsWithPositions.forEach(target => {
      const before = html.slice(0, target.index);
      const match = html.slice(
        target.index,
        target.index + target.text.length
      );
      const after = html.slice(target.index + target.text.length);

      html =
        `${before}<span class="pos-target">` +
          `<span class="pos-word">${match}</span>` +
          `<span class="pos-label">${target.pos}</span>` +
        `</span>${after}`;
    });

    sourceElement.innerHTML = html;

    sourceElement.querySelectorAll('.pos-target').forEach(posTarget => {
      createdPosTargets.push(posTarget);
    });
  });

  return () => {
    createdPosTargets.forEach(posTarget => {
      if (!posTarget.isConnected) return;

      const word =
        posTarget.querySelector('.pos-word')?.textContent ??
        posTarget.textContent;

      posTarget.replaceWith(word);
    });
  };
}

function applyHighlightFeedback(targets) {
  const createdHighlights = [];

  targets.forEach(target => {
    let sourceElement;

    if (target.source === 'passage') {
      sourceElement = document.querySelector('.passage');
    } else if (target.source === 'question') {
      sourceElement = document.querySelector('.question-text');
    } else if (target.source === 'choice') {
      sourceElement = document.querySelector(
        `.choice[data-choice="${target.choice}"] .choice-text`
      );
    }

    if (!sourceElement) return;

    const text = sourceElement.textContent;
    const startIndex = text.indexOf(target.text);

    if (startIndex === -1) return;

    const before = text.slice(0, startIndex);
    const match = text.slice(startIndex, startIndex + target.text.length);
    const after = text.slice(startIndex + target.text.length);

    sourceElement.innerHTML =
      `${before}<span class="feedback-highlight">${match}</span>${after}`;

    const highlight = sourceElement.querySelector('.feedback-highlight');

    if (highlight) {
      createdHighlights.push(highlight);
    }
  });

  return () => {
    createdHighlights.forEach(highlight => {
      if (highlight.isConnected) {
        highlight.replaceWith(highlight.textContent);
      }
    });
  };
}

async function loadCueContent() {
  try {
    const response = await fetch('data/sample.json');
    cueData = await response.json();

    questions = cueData.questionSets.flatMap(set =>
      set.questions.map(question => ({
        ...question,
        passage: set.passage
      }))
    );

    questionStates = questions.map(() => ({
      solved: false,
      attemptedChoices: []
    }));

    displayQuestion(questionIndex);

  } catch (error) {
    console.error('Error loading cue content:', error);
  }
}

function updateNavigation() {
  const state = questionStates[questionIndex];
  const prevButton = document.getElementById('prevQuestionButton');
  const nextButton = document.getElementById('nextQuestionButton');

  const showNavigation = state.solved;

  prevButton.classList.toggle(
    'hidden',
    !showNavigation || questionIndex === 0
  );

  nextButton.classList.toggle(
    'hidden',
    !showNavigation || questionIndex === questions.length - 1
  );
}

function updateChoiceStates(state, question, activeChoice = null) {
  document.querySelectorAll('.choice').forEach(button => {
    const letter = button.dataset.choice;
    const wasAttempted = state.attemptedChoices.includes(letter);
    const isIncorrect = letter !== question.correct;
    const isActive = letter === activeChoice;

    button.classList.toggle(
      'eliminated',
      state.solved && wasAttempted && isIncorrect && !isActive
    );
  });
}

function restoreSolvedState(state, question) {
  if (!state.solved) return;

  const feedbackArea = document.querySelector('.feedback-area');
  const correctChoice = question.choices[question.correct];
  const correctButton = document.querySelector(
    `.choice[data-choice="${question.correct}"]`
  );

  feedbackArea.textContent = '✓';
  correctButton?.classList.add('selected');

  applyFeedback(correctChoice, question);
  updateChoiceStates(state, question, question.correct);
}

function displayQuestion(index) {
  questionIndex = index;

  const cueContent = document.getElementById('cue-content');
  const question = questions[index];
  const state = questionStates[index];

cueContent.innerHTML = `
  ${question.passage ? `<p class="passage">${question.passage}</p>` : ''}

    <table class="question-and-choices">
        <tr>
        <td class="left-cell">
          <span class="question-number">${index + 1}. </span>
        </td>

        <td class="right-cell">
          <span class="question-text">${question.question}</span>
        </td>
      </tr>

      <tr>
        <td class="answer-cell"><span class="feedback-area"></span>
        </td>

        <td class="right-cell">
          <div class="choices">
            ${Object.entries(question.choices).map(([letter, choice]) => `
              <button class="choice" data-choice="${letter}">
                <span class="choice-letter">(${letter})&nbsp</span>
                <span class="choice-text">${choice.text}</span>
              </button>
            `).join('')}
          </div>
        </td>
      </tr>
    </table>
  `;

  restoreSolvedState(state, question);
  updateNavigation();

  document.querySelectorAll('.choice').forEach(button => {
    button.addEventListener('click', () => {
      const selectedChoice = button.dataset.choice;
      const choice = question.choices[selectedChoice];
      const feedbackArea = document.querySelector('.feedback-area');

      document.querySelectorAll('.choice').forEach(choiceButton => {
        choiceButton.classList.remove('selected');
      });

      button.classList.add('selected');

    if (!state.solved && !state.attemptedChoices.includes(selectedChoice)) {
      state.attemptedChoices.push(selectedChoice);
    }

    if (selectedChoice === question.correct) {
      feedbackArea.textContent = '✓';
      state.solved = true;
      updateNavigation();
    } else {
      feedbackArea.textContent = '✕';
    }

    updateChoiceStates(state, question, selectedChoice);
    applyFeedback(choice, question);
      });
    });
  }

document.getElementById('prevQuestionButton').addEventListener('click', () => {
  if (questionIndex > 0) {
    displayQuestion(questionIndex - 1);
  }
});

document.getElementById('nextQuestionButton').addEventListener('click', () => {
  if (questionIndex < questions.length - 1) {
    displayQuestion(questionIndex + 1);
  }
});

loadCueContent();

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
    
    /*
    settingsButton.addEventListener('click', () => {
      settingsButton.blur();
      document.getElementById('settingsMenu')?.classList.toggle('show');
    });
    */
});

document.querySelectorAll('.circle-btn').forEach(button => {
  button.addEventListener('touchstart', () => {
    button.classList.add('active');
  });

  const removeActive = () => {
    button.classList.remove('active');
  };

  button.addEventListener('touchend', removeActive);
  button.addEventListener('touchcancel', removeActive);
});
