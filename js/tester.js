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

    case 'annotation':
      activeFeedbackCleanup = applyAnnotationFeedback(choice.targets);
      break;

    default:
      console.warn(`Unknown feedback type: ${choice.feedbackType}`);
  }
}

function applyCorrectAnswerFeedback(question, includeChoiceTargets = true) {
  const correctChoice = question.choices[question.correct];

  if (includeChoiceTargets) {
    applyFeedback(correctChoice, question);
    return;
  }

  const filteredChoice = {
    ...correctChoice,
    targets: correctChoice.targets.filter(
      target => target.source !== 'choice'
    )
  };

  applyFeedback(filteredChoice, question);
}

function applyAnnotationFeedback(targets) {
  const createdAnnotationTargets = [];
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
        `${before}<span class="annotation-target">` +
          `<span class="annotation-word">${match}</span>` +
          `<span class="annotation-label">${target.annotation}</span>` +
        `</span>${after}`;
    });

    sourceElement.innerHTML = html;

    sourceElement.querySelectorAll('.annotation-target').forEach(annotationTarget => {
      createdAnnotationTargets.push(annotationTarget);
    });
  });

  return () => {
    createdAnnotationTargets.forEach(annotationTarget => {
      if (!annotationTarget.isConnected) return;

      const word =
        annotationTarget.querySelector('.annotation-word')?.textContent ??
        annotationTarget.textContent;

      annotationTarget.replaceWith(word);
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
      correctAnswered: false,
      proveSolved: false,
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
      wasAttempted && isIncorrect && !isActive
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

      <div class="prove-area ${question.prove ? 'hidden' : ''}">
        ${question.prove ? `
          <div class="prove-title">Prove it!</div>
          <div class="prove-prompt">${question.prove.prompt}</div>

          <div class="prove-options">
            ${question.prove.options.map(option => `
              <button
                class="prove-option"
                data-prove-option="${option}"
              >
                ${option}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
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

    if (
      !state.correctAnswered &&
      !state.attemptedChoices.includes(selectedChoice)
    ) {
      state.attemptedChoices.push(selectedChoice);
    }

    if (selectedChoice === question.correct) {
      feedbackArea.textContent = '✓';
      state.correctAnswered = true;

      if (question.prove && !state.proveSolved) {
        state.solved = false;

        document.querySelector('.prove-area')?.classList.remove('hidden');

        applyCorrectAnswerFeedback(question, false);
      } else {
        state.solved = true;

        applyCorrectAnswerFeedback(question, true);
        updateNavigation();
      }

    } else {
      feedbackArea.textContent = '✕';

      if (question.prove && !state.proveSolved) {
        document.querySelector('.prove-area')?.classList.add('hidden');
      }

      applyFeedback(choice, question);
    }

    updateChoiceStates(state, question, selectedChoice);
      });
    });

      document.querySelectorAll('.prove-option').forEach(button => {
        button.addEventListener('click', () => {
          const selectedOption = button.dataset.proveOption;

          document.querySelectorAll('.prove-option').forEach(optionButton => {
            optionButton.classList.remove('correct', 'incorrect');
          });

          if (selectedOption === question.prove.correct) {
            button.classList.add('correct');
            button.disabled = true;

            state.proveSolved = true;
            state.solved = true;

            applyCorrectAnswerFeedback(question, true);

            updateNavigation();
          } else {
            button.classList.add('incorrect');
            button.disabled = true;
          }
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
