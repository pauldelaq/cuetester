let cueData = null;
let questions = [];
let questionIndex = 0;
let questionStates = [];
let activeFeedbackCleanup = null;
let basePassageHtml = '';

function applyFeedback(choice, question) {

  if (activeFeedbackCleanup) {
    activeFeedbackCleanup();
    activeFeedbackCleanup = null;
  }

  restoreBasePassageHtml();

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

    // Passage targets need to preserve the existing formatted HTML.
    if (target.source === 'passage') {
      const annotationTarget = wrapPassageText(target.text, match => {
        const hasAnnotation = target.annotation !== '';

        const wrapper = document.createElement('span');

        wrapper.className = hasAnnotation
          ? 'annotation-target'
          : 'annotation-target annotation-highlight-only';

        const word = document.createElement('span');
        word.className = 'annotation-word';
        word.textContent = match;

        wrapper.appendChild(word);

        if (hasAnnotation) {
          const label = document.createElement('span');
          label.className = 'annotation-label';
          label.textContent = target.annotation;

          wrapper.appendChild(label);
        }

        return wrapper;
      });

      if (annotationTarget) {
        createdAnnotationTargets.push(annotationTarget);
      }

      return;
    }

    // Question and choice targets can continue using the existing logic.
    let sourceElement;

    if (target.source === 'question') {
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

      const after = html.slice(
        target.index + target.text.length
      );

      const hasAnnotation = target.annotation !== '';

      const annotationLabel = hasAnnotation
        ? `<span class="annotation-label">${target.annotation}</span>`
        : '';

      const targetClass = hasAnnotation
        ? 'annotation-target'
        : 'annotation-target annotation-highlight-only';

      html =
        `${before}<span class="${targetClass}">` +
          `<span class="annotation-word">${match}</span>` +
          annotationLabel +
        `</span>${after}`;
    });

    sourceElement.innerHTML = html;

    sourceElement
      .querySelectorAll('.annotation-target')
      .forEach(annotationTarget => {
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

function wrapPassageText(targetText, createWrapper) {
  const passageElement = document.querySelector('.passage');
  if (!passageElement) return null;
  const walker = document.createTreeWalker(
    passageElement,
    NodeFilter.SHOW_TEXT
  );

  let textNode;

  while ((textNode = walker.nextNode())) {
    const startIndex = textNode.textContent.indexOf(targetText);
    if (startIndex === -1) continue;
    const before = textNode.textContent.slice(0, startIndex);
    const match = textNode.textContent.slice(
      startIndex,
      startIndex + targetText.length
    );
    const after = textNode.textContent.slice(
      startIndex + targetText.length
    );
    const wrapper = createWrapper(match);
    const fragment = document.createDocumentFragment();
    if (before) {
      fragment.appendChild(document.createTextNode(before));
    }
    fragment.appendChild(wrapper);
    if (after) {
      fragment.appendChild(document.createTextNode(after));
    }
    textNode.replaceWith(fragment);
    return wrapper;
  }

  return null;
}

function applyHighlightFeedback(targets) {
  const createdHighlights = [];

  targets.forEach(target => {

    if (target.source === 'passage') {
      const highlight = wrapPassageText(target.text, match => {
        const span = document.createElement('span');
        span.className = 'feedback-highlight';
        span.textContent = match;
        return span;
      });

      if (highlight) {
        createdHighlights.push(highlight);
      }

      return;
    }

    let sourceElement;

    if (target.source === 'question') {
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
    const match = text.slice(
      startIndex,
      startIndex + target.text.length
    );
    const after = text.slice(startIndex + target.text.length);

    sourceElement.innerHTML =
      `${before}<span class="feedback-highlight">${match}</span>${after}`;

    const highlight =
      sourceElement.querySelector('.feedback-highlight');

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

    let runningQuestionNumber = 1;

    questions = cueData.questionSets.flatMap(set => {
      const setStartNumber = runningQuestionNumber;
      runningQuestionNumber += set.questions.length;

      return set.questions.map(question => ({
        ...question,
        passage: set.passage,
        setStartNumber
      }));
    });

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

function renderPassageBlanks(question) {
  const passageElement = document.querySelector('.passage');

  if (!passageElement) return;

  passageElement
    .querySelectorAll('.passage-blank')
    .forEach((blank, blankIndex) => {
      const questionNumber =
        question.setStartNumber + blankIndex;

      blank.innerHTML = `
        <span class="passage-blank-line">-------</span>
        <span class="passage-blank-number">${questionNumber}.</span>
      `;
    });
}

function storeBasePassageHtml() {
  const passageElement = document.querySelector('.passage');

  basePassageHtml = passageElement
    ? passageElement.innerHTML
    : '';
}

function restoreBasePassageHtml() {
  const passageElement = document.querySelector('.passage');

  if (passageElement && basePassageHtml) {
    passageElement.innerHTML = basePassageHtml;
  }
}

function displayQuestion(index) {
  questionIndex = index;

  const cueContent = document.getElementById('cue-content');
  const question = questions[index];
  const state = questionStates[index];

  cueContent.innerHTML = `
    ${question.passage ? `<div class="passage">${question.passage}</div>` : ''}

      <table class="question-and-choices ${question.question ? '' : 'no-question-text'}">
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

  renderPassageBlanks(question);
  storeBasePassageHtml();

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
