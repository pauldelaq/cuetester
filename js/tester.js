let cueData = null;
let questions = [];
let questionIndex = 0;
let questionStates = [];
let activeFeedbackCleanup = null;
let basePassageHtml = '';
let visualMode = 'feedback';
let screenMode = 'questions';
let activeTranslationCleanup = null;
let translationLanguage = 'zh-TW';

let scrollCue = null;

function ensureScrollCue() {
  if (scrollCue) return scrollCue;

  scrollCue = document.createElement('button');
  scrollCue.type = 'button';
  scrollCue.className = 'scroll-down-cue hidden';
  scrollCue.setAttribute('aria-label', 'More content below');
  scrollCue.innerHTML = '⌄';

  scrollCue.addEventListener('click', () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  });

  document.body.appendChild(scrollCue);

  return scrollCue;
}

function updateScrollCue() {
  const cue = ensureScrollCue();

  const documentHeight = document.documentElement.scrollHeight;
  const viewportBottom = window.scrollY + window.innerHeight;

  const scrollCueBuffer = 120;

  const hasMoreBelow =
    documentHeight - viewportBottom > scrollCueBuffer;

  cue.classList.toggle('hidden', !hasMoreBelow);
}

function refreshScrollCue() {
  requestAnimationFrame(() => {
    requestAnimationFrame(updateScrollCue);
  });
}

function initializeLanguageDropdown() {
  translationLanguage =
    localStorage.getItem('translationLanguage') || 'zh-TW';

  const languageSelector =
    document.getElementById('language-selector');

  languageSelector.value = translationLanguage;

  languageSelector.addEventListener('change', () => {
    translationLanguage = languageSelector.value;

    localStorage.setItem(
      'translationLanguage',
      translationLanguage
    );
  });
}

function clearVisualState() {
  if (activeTranslationCleanup) {
    activeTranslationCleanup();
    activeTranslationCleanup = null;
  }

  if (activeFeedbackCleanup) {
    activeFeedbackCleanup();
    activeFeedbackCleanup = null;
  }

  restoreBasePassageHtml();

  document.querySelectorAll('.choice').forEach(button => {
    button.classList.remove('selected', 'eliminated');
  });

  const feedbackArea = document.querySelector('.feedback-area');

  if (feedbackArea) {
    feedbackArea.textContent = '';
    feedbackArea.classList.remove(
      'correct-color',
      'incorrect-color'
    );
  }

  const proveArea = document.querySelector('.prove-area');

  if (proveArea) {
    proveArea.classList.add('hidden');
  }
}

function enterTranslationMode() {
  if (visualMode === 'translation') return;

  clearVisualState();

  visualMode = 'translation';

  activeTranslationCleanup = applyTranslations();
}

function exitTranslationMode() {
  if (visualMode !== 'translation') return;

  clearVisualState();

  visualMode = 'feedback';

  const question = questions[questionIndex];
  const state = questionStates[questionIndex];

  restoreQuestionState(state, question);
}

function wrapTranslationText(sourceElement, targetText, translation) {
  if (!sourceElement) return null;

  const text = sourceElement.textContent;
  const startIndex = text.indexOf(targetText);

  if (startIndex === -1) return null;

  const before = text.slice(0, startIndex);
  const match = text.slice(
    startIndex,
    startIndex + targetText.length
  );
  const after = text.slice(startIndex + targetText.length);

  sourceElement.textContent = '';

  if (before) {
    sourceElement.appendChild(
      document.createTextNode(before)
    );
  }

  const span = document.createElement('span');
  span.className = 'translation-target';

  const source = document.createElement('span');
  source.className = 'translation-source';
  source.textContent = match;

  const label = document.createElement('span');
  label.className = 'translation-label';
  label.textContent = translation;

  span.appendChild(source);
  span.appendChild(label);

  span.addEventListener('click', event => {
    event.stopPropagation();
    span.classList.toggle('translation-visible');
  });

  sourceElement.appendChild(span);

  if (after) {
    sourceElement.appendChild(
      document.createTextNode(after)
    );
  }

  return span;
}

function applyTranslations() {
  const createdTargets = [];

  const translationData = cueData?.translations || {};

  Object.entries(translationData).forEach(
    ([english, translations]) => {

      const translation =
        translations[translationLanguage];

      if (!translation) return;

      // Passage
      const passageTarget = wrapPassageText(
        english,
        match => {
          const span = document.createElement('span');
          span.className = 'translation-target';

          const source = document.createElement('span');
          source.className = 'translation-source';
          source.textContent = match;

          const label = document.createElement('span');
          label.className = 'translation-label';
          label.textContent = translation;

          span.appendChild(source);
          span.appendChild(label);

          span.addEventListener('click', event => {
            event.stopPropagation();
            span.classList.toggle('translation-visible');
          });

          return span;
        }
      );

      if (passageTarget) {
        createdTargets.push(passageTarget);
      }

      // Question
      const questionTarget = wrapTranslationText(
        document.querySelector('.question-text'),
        english,
        translation
      );

      if (questionTarget) {
        createdTargets.push(questionTarget);
      }

      // Choices
      document
        .querySelectorAll('.choice-text')
        .forEach(choiceElement => {
          const choiceTarget = wrapTranslationText(
            choiceElement,
            english,
            translation
          );

          if (choiceTarget) {
            createdTargets.push(choiceTarget);
          }
        });
    }
  );

  return () => {
    createdTargets.forEach(target => {
      if (!target.isConnected) return;

      const sourceText =
        target.querySelector('.translation-source')?.textContent ??
        target.textContent;

      target.replaceWith(sourceText);
    });
  };
}

function updateQuestionIndicator(index) {
  const lessonIndicator = document.getElementById("lesson-indicator");
  if (lessonIndicator && cueData && cueData.lessonName) {
    lessonIndicator.textContent = cueData.lessonName;
  }
  
  const questionIndicator = document.getElementById("question-indicator");
  if (questionIndicator) {
    questionIndicator.textContent = `${index + 1} / ${questions.length}`;
  }
}

function displayInstructions() {
  screenMode = 'instructions';

  const cueContent = document.getElementById('cue-content');
  const lessonIndicator = document.getElementById('lesson-indicator');
  const questionIndicator = document.getElementById('question-indicator');
  const prevButton = document.getElementById('prevQuestionButton');
  const nextButton = document.getElementById('nextQuestionButton');
  const nextArrow = document.getElementById('next-arrow');

  if (lessonIndicator && cueData?.lessonName) {
    lessonIndicator.textContent = cueData.lessonName;
  }

  if (questionIndicator) {
    questionIndicator.textContent = '';
  }

  cueContent.innerHTML = `
    <div class="test-instructions">
      ${cueData.instructions}
    </div>
  `;

  prevButton?.classList.add('hidden');
  nextButton?.classList.remove('hidden');
  nextArrow?.classList.add('next-icon-pulse');
}

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

    case 'focus':
      activeFeedbackCleanup = applyFocusFeedback(choice.targets);
      break;

    default:
      console.warn(`Unknown feedback type: ${choice.feedbackType}`);
  }
}

/// answer feedback types

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

function findOccurrenceIndex(text, targetText, occurrence = 1) {
  let searchIndex = 0;
  let matchCount = 0;

  while (searchIndex < text.length) {
    const startIndex = text.indexOf(targetText, searchIndex);

    if (startIndex === -1) return -1;

    matchCount++;

    if (matchCount === occurrence) {
      return startIndex;
    }

    searchIndex = startIndex + targetText.length;
  }

  return -1;
}

function applyAnnotationFeedback(targets) {
  const createdAnnotationTargets = [];
  const createdChoiceAnnotationBlocks = [];

  const createdFootnoteTargets = [];
  const createdFootnoteAreas = [];
  const footnotesBySource = new Map();
  const phraseTargets = [];

  const groupedTargets = new Map();

  targets.forEach(target => {
    const hasAnnotation = Boolean(target.annotation);
    const isPhrase = target.text.includes(' ');

    if (
      hasAnnotation &&
      isPhrase &&
      (target.source === 'passage' || target.source === 'question')
    ) {
      phraseTargets.push(target);
      return;
    }

    // Passage targets need to preserve the existing formatted HTML.
    if (target.source === 'passage') {
      const annotationTarget = wrapPassageText(target.text, match => {
        const hasAnnotation = Boolean(target.annotation);
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
      }, target.occurrence ?? 1);

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

    const isChoiceSource = Boolean(
      sourceElement.closest('.choice')
    );

    const choiceAnnotations = [];
    const targetsWithPositions = elementTargets
      .map(target => ({
        ...target,
        index: findOccurrenceIndex(
          html,
          target.text,
          target.occurrence ?? 1
        )
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

      const hasAnnotation = Boolean(target.annotation);

      if (isChoiceSource) {
        const wrappedMatch =
          `<span class="annotation-word">${match}</span>`;

        html = `${before}${wrappedMatch}${after}`;

        if (hasAnnotation) {
          choiceAnnotations.unshift(target.annotation);
        }

        return;
      }

      const annotationLabel = hasAnnotation
        ? `<span class="annotation-label">${target.annotation}</span>`
        : '';

      const isPhrase = target.text.includes(' ');

      const targetClass = hasAnnotation
        ? `annotation-target${isPhrase ? ' annotation-phrase' : ''}`
        : 'annotation-target annotation-highlight-only';

      html =
        `${before}<span class="${targetClass}">` +
          `<span class="annotation-word">${match}</span>` +
          annotationLabel +
        `</span>${after}`;
    });

    sourceElement.innerHTML = html;

    if (isChoiceSource && choiceAnnotations.length) {
      const annotationBlock = document.createElement('div');
      annotationBlock.className = 'choice-annotation';
      annotationBlock.textContent = choiceAnnotations.join(' ');

      sourceElement.appendChild(annotationBlock);
      createdChoiceAnnotationBlocks.push(annotationBlock);
    }

    sourceElement
      .querySelectorAll('.annotation-target')
      .forEach(annotationTarget => {
        createdAnnotationTargets.push(annotationTarget);
      });
  });

  phraseTargets.forEach(target => {
    let sourceElement;

    if (target.source === 'passage') {
      sourceElement = document.querySelector('.passage');
    } else {
      sourceElement = document.querySelector('.question-text');
    }

    if (!sourceElement) return;

    if (!footnotesBySource.has(sourceElement)) {
      footnotesBySource.set(sourceElement, []);
    }

    const footnotes = footnotesBySource.get(sourceElement);
    const footnoteNumber = footnotes.length + 1;

    footnotes.push({
      number: footnoteNumber,
      text: target.annotation
    });

    let footnoteTarget = null;

    if (target.source === 'passage') {
      footnoteTarget = wrapPassageText(
        target.text,
        match => {
          const wrapper = document.createElement('span');
          wrapper.className = 'annotation-footnote-target';

          const highlighted = document.createElement('span');
          highlighted.className = 'annotation-word';
          highlighted.textContent = match;

          const marker = document.createElement('sup');
          marker.className = 'annotation-footnote-ref';
          marker.textContent = footnoteNumber;

          wrapper.appendChild(highlighted);
          wrapper.appendChild(marker);

          return wrapper;
        },
        target.occurrence ?? 1
      );
    } else {
      const walker = document.createTreeWalker(
        sourceElement,
        NodeFilter.SHOW_TEXT
      );

      let textNode;
      let matchCount = 0;

      while ((textNode = walker.nextNode())) {
        let searchIndex = 0;

        while (searchIndex < textNode.textContent.length) {
          const startIndex = textNode.textContent.indexOf(
            target.text,
            searchIndex
          );

          if (startIndex === -1) break;

          matchCount++;

          if (matchCount === (target.occurrence ?? 1)) {
            const before = textNode.textContent.slice(0, startIndex);

            const match = textNode.textContent.slice(
              startIndex,
              startIndex + target.text.length
            );

            const after = textNode.textContent.slice(
              startIndex + target.text.length
            );

            const wrapper = document.createElement('span');
            wrapper.className = 'annotation-footnote-target';

            const highlighted = document.createElement('span');
            highlighted.className = 'annotation-word';
            highlighted.textContent = match;

            const marker = document.createElement('sup');
            marker.className = 'annotation-footnote-ref';
            marker.textContent = footnoteNumber;

            wrapper.appendChild(highlighted);
            wrapper.appendChild(marker);

            const fragment = document.createDocumentFragment();

            if (before) {
              fragment.appendChild(
                document.createTextNode(before)
              );
            }

            fragment.appendChild(wrapper);

            if (after) {
              fragment.appendChild(
                document.createTextNode(after)
              );
            }

            textNode.replaceWith(fragment);
            footnoteTarget = wrapper;
            break;
          }

          searchIndex = startIndex + target.text.length;
        }

        if (footnoteTarget) break;
      }
    }

    if (footnoteTarget) {
      createdFootnoteTargets.push(footnoteTarget);
    }
  });

  footnotesBySource.forEach((footnotes, sourceElement) => {
    if (!footnotes.length) return;

    const notesArea = document.createElement('div');
    notesArea.className = 'annotation-footnotes';

    footnotes.forEach(note => {
      const noteElement = document.createElement('div');
      noteElement.className = 'annotation-footnote';

      const marker = document.createElement('sup');
      marker.className = 'annotation-footnote-marker';
      marker.textContent = note.number;

      noteElement.appendChild(marker);
      noteElement.appendChild(
        document.createTextNode(` ${note.text}`)
      );

      notesArea.appendChild(noteElement);
    });

    sourceElement.insertAdjacentElement('afterend', notesArea);
    createdFootnoteAreas.push(notesArea);
  });

  return () => {
    createdFootnoteAreas.forEach(area => {
      if (area.isConnected) {
        area.remove();
      }
    });

    createdFootnoteTargets.forEach(footnoteTarget => {
      if (!footnoteTarget.isConnected) return;

      const text =
        footnoteTarget.querySelector('.annotation-word')?.textContent ??
        footnoteTarget.textContent;

      footnoteTarget.replaceWith(text);
    });

    createdChoiceAnnotationBlocks.forEach(annotationBlock => {
      if (annotationBlock.isConnected) {
        annotationBlock.remove();
      }
    });

    document
      .querySelectorAll('.choice-text .annotation-word')
      .forEach(annotationWord => {
        if (annotationWord.isConnected) {
          annotationWord.replaceWith(annotationWord.textContent);
        }
      });

    createdAnnotationTargets.forEach(annotationTarget => {
      if (!annotationTarget.isConnected) return;

      const word =
        annotationTarget.querySelector('.annotation-word')?.textContent ??
        annotationTarget.textContent;

      annotationTarget.replaceWith(word);
    });
  };
}

function wrapPassageText(targetText, createWrapper, occurrence = 1) {
  const passageElement = document.querySelector('.passage');

  if (!passageElement) return null;

  const walker = document.createTreeWalker(
    passageElement,
    NodeFilter.SHOW_TEXT
  );

  let textNode;
  let matchCount = 0;

  while ((textNode = walker.nextNode())) {
    let searchIndex = 0;

    while (searchIndex < textNode.textContent.length) {
      const startIndex = textNode.textContent.indexOf(
        targetText,
        searchIndex
      );

      if (startIndex === -1) break;

      matchCount++;

      if (matchCount === occurrence) {
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
          fragment.appendChild(
            document.createTextNode(before)
          );
        }

        fragment.appendChild(wrapper);

        if (after) {
          fragment.appendChild(
            document.createTextNode(after)
          );
        }

        textNode.replaceWith(fragment);

        return wrapper;
      }

      searchIndex = startIndex + targetText.length;
    }
  }

  return null;
}

function applyHighlightFeedback(targets) {
  const createdHighlights = [];

  targets.forEach(target => {

    if (target.source === 'passage') {
      const highlight = wrapPassageText(
        target.text,
        match => {
          const span = document.createElement('span');
          span.className = 'feedback-highlight';
          span.textContent = match;
          return span;
        },
        target.occurrence ?? 1
      );

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

    const startIndex = findOccurrenceIndex(
      text,
      target.text,
      target.occurrence ?? 1
    );

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

function applyFocusFeedback(targets) {
  const passageElement = document.querySelector('.passage');

  if (!passageElement) {
    return () => {};
  }

  const createdFocusTargets = [];
  const createdBlurredTargets = [];

  // First, identify and wrap everything that should remain clear.
  targets.forEach(target => {
    if (target.source !== 'passage') return;

    const focusTarget = wrapPassageText(
      target.text,
      match => {
        const span = document.createElement('span');
        span.className = 'focus-target';
        span.textContent = match;
        return span;
      },
      target.occurrence ?? 1
    );

    if (focusTarget) {
      createdFocusTargets.push(focusTarget);
    }
  });

  // Now collect all remaining text nodes in the passage.
  const walker = document.createTreeWalker(
    passageElement,
    NodeFilter.SHOW_TEXT
  );

  const textNodes = [];
  let textNode;

  while ((textNode = walker.nextNode())) {
    textNodes.push(textNode);
  }

  // Blur every text node that isn't inside one of the focus targets.
  textNodes.forEach(node => {
    if (!node.textContent.trim()) return;

    if (node.parentElement?.closest('.focus-target')) {
      return;
    }

    const blurred = document.createElement('span');
    blurred.className = 'feedback-blurred';
    blurred.textContent = node.textContent;

    node.replaceWith(blurred);
    createdBlurredTargets.push(blurred);
  });

  return () => {
    createdBlurredTargets.forEach(blurred => {
      if (blurred.isConnected) {
        blurred.replaceWith(blurred.textContent);
      }
    });

    createdFocusTargets.forEach(focusTarget => {
      if (focusTarget.isConnected) {
        focusTarget.replaceWith(focusTarget.textContent);
      }
    });
  };
}

async function loadCueContent() {
  try {
    const params = new URLSearchParams(window.location.search);
    const part = params.get('part') || '1';
    const dataSource = `data/part${part}.json`;

    const response = await fetch(dataSource);
    cueData = await response.json();

    let runningQuestionNumber = 1;

    questions = cueData.questionSets.flatMap((set, setIndex) => {
      const setStartNumber = runningQuestionNumber;
      runningQuestionNumber += set.questions.length;

      return set.questions.map(question => ({
        ...question,
        passage: set.passage,
        setIndex,
        setStartNumber
      }));
    });

    questionStates = questions.map(() => ({
      correctAnswered: false,
      proveSolved: false,
      solved: false,
      attemptedChoices: [],
      activeChoice: null
    }));

  if (cueData.instructions) {
    displayInstructions();
  } else {
    screenMode = 'questions';
    displayQuestion(questionIndex);
  }

  } catch (error) {
    console.error('Error loading cue content:', error);
  }
}

function updateNavigation(pulseNext = false) {
  const state = questionStates[questionIndex];
  const prevButton = document.getElementById('prevQuestionButton');
  const nextButton = document.getElementById('nextQuestionButton');
  const nextArrow = document.getElementById('next-arrow');

  const showNavigation = state.solved;

  prevButton.classList.toggle(
    'hidden',
    !showNavigation || questionIndex === 0
  );

  nextButton.classList.toggle(
    'hidden',
    !showNavigation || questionIndex === questions.length - 1
  );

  if (nextArrow) {
    nextArrow.classList.toggle(
      'next-icon-pulse',
      pulseNext &&
      showNavigation &&
      questionIndex < questions.length - 1
    );
  }
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
  feedbackArea.classList.remove('incorrect-color');
  feedbackArea.classList.add('correct-color');
  correctButton?.classList.add('selected');

  applyFeedback(correctChoice, question);
  updateChoiceStates(state, question, question.correct);
}

function restoreQuestionState(state, question) {
  restoreBasePassageHtml();

  if (activeFeedbackCleanup) {
    activeFeedbackCleanup();
    activeFeedbackCleanup = null;
  }

  document.querySelectorAll('.choice').forEach(button => {
    button.classList.remove('selected');
  });

  const feedbackArea = document.querySelector('.feedback-area');

  if (feedbackArea) {
    feedbackArea.textContent = '';
    feedbackArea.classList.remove(
      'correct-color',
      'incorrect-color'
    );
  }

  if (state.solved) {
    restoreSolvedState(state, question);
    return;
  }

  if (!state.activeChoice) {
    updateChoiceStates(state, question);
    return;
  }

  const activeChoice = state.activeChoice;

  const activeButton = document.querySelector(
    `.choice[data-choice="${activeChoice}"]`
  );

  activeButton?.classList.add('selected');

  if (activeChoice === question.correct) {
    if (feedbackArea) {
      feedbackArea.textContent = '✓';
      feedbackArea.classList.add('correct-color');
    }

    if (question.prove && !state.proveSolved) {
      showProveActivity(question, state);
    } else {
      applyCorrectAnswerFeedback(question, true);
    }

  } else {
    if (feedbackArea) {
      feedbackArea.textContent = '✕';
      feedbackArea.classList.add('incorrect-color');
    }

    applyFeedback(
      question.choices[activeChoice],
      question
    );
  }

  updateChoiceStates(
    state,
    question,
    activeChoice
  );
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

const proveStatus = document.getElementById('prove-status');

function showProveActivity(question, state) {
  if (!question.prove) return;

  const proveArea = document.querySelector('.prove-area');
  if (!proveArea) return;

  proveArea.innerHTML = `
    <div class="prove-title">Prove it! <input type="checkbox" id="prove-status"></div>
    <div class="prove-prompt">${question.prove.prompt}</div>
    <div class="prove-content"></div>
  `;

  proveArea.classList.remove('hidden');
  refreshScrollCue();

  switch (question.prove.type) {
    case 'choice':
      showChoiceProve(question, state, proveArea);
      break;

    case 'find-and-click':
      showFindAndClickProve(question, state, proveArea);
      break;

    default:
      console.warn(`Unknown prove type: ${question.prove.type}`);
  }
}

/// prove types

function showChoiceProve(question, state, proveArea) {
  applyCorrectAnswerFeedback(question, false);

  const proveContent = proveArea.querySelector('.prove-content');
  if (!proveContent) return;

  proveContent.innerHTML = `
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
  `;

  proveArea.querySelectorAll('.prove-option').forEach(button => {
    button.addEventListener('click', () => {
      const selectedOption = button.dataset.proveOption;

      proveArea.querySelectorAll('.prove-option').forEach(optionButton => {
        optionButton.classList.remove('correct', 'incorrect');
      });

      if (selectedOption === question.prove.correct) {
        button.classList.add('correct');
        button.disabled = true;

        state.proveSolved = true;
        state.solved = true;

        applyCorrectAnswerFeedback(question, true);
        updateNavigation(true);

        refreshScrollCue();

        // << Add: Check the prove-status checkbox when solved >>
        const proveCheckbox = proveArea.querySelector('#prove-status');
        if (proveCheckbox) {
          proveCheckbox.checked = true;
        }
      } else {
        button.classList.add('incorrect');
        button.disabled = true;
      }
    });
  });
}

function showFindAndClickProve(question, state, proveArea) {
  if (activeFeedbackCleanup) {
    activeFeedbackCleanup();
    activeFeedbackCleanup = null;
  }

  restoreBasePassageHtml();

  let target = null;

  const source = question.prove.source || 'passage';

  if (source === 'passage') {
    target = wrapPassageText(
      question.prove.correct,
      match => {
        const span = document.createElement('span');
        span.className = 'prove-find-target';
        span.textContent = match;
        return span;
      }
    );
  }

  if (source === 'question') {
    const questionElement =
      document.querySelector('.question-text');

    if (questionElement) {
      const text = questionElement.textContent;

      const startIndex =
        text.indexOf(question.prove.correct);

      if (startIndex !== -1) {
        const before =
          text.slice(0, startIndex);

        const match =
          text.slice(
            startIndex,
            startIndex + question.prove.correct.length
          );

        const after =
          text.slice(
            startIndex + question.prove.correct.length
          );

        questionElement.textContent = '';

        if (before) {
          questionElement.appendChild(
            document.createTextNode(before)
          );
        }

        target = document.createElement('span');
        target.className = 'prove-find-target';
        target.textContent = match;

        questionElement.appendChild(target);

        if (after) {
          questionElement.appendChild(
            document.createTextNode(after)
          );
        }
      }
    }
  }

  if (!target) {
    console.warn(
      `Could not find prove target in ${source}: ${question.prove.correct}`
    );
    return;
  }

  target.addEventListener('click', () => {
    if (state.proveSolved) return;

    state.proveSolved = true;
    state.solved = true;

    applyCorrectAnswerFeedback(question, true);
    updateChoiceStates(state, question, question.correct);
    updateNavigation(true);

    refreshScrollCue();

    const proveCheckbox =
      proveArea.querySelector('#prove-status');

    if (proveCheckbox) {
      proveCheckbox.checked = true;
    }
  });
}

function displayQuestion(index) {
  screenMode = 'questions';
  questionIndex = index;
  updateQuestionIndicator(index);

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

    <div id="prove-area" class="prove-area hidden"></div>
    `;

  renderPassageBlanks(question);
  storeBasePassageHtml();

  restoreQuestionState(state, question);
  updateNavigation();

  refreshScrollCue();

  document.querySelectorAll('.choice').forEach(button => {
    button.addEventListener('click', () => {

      if (visualMode !== 'feedback') {
        clearVisualState();
        visualMode = 'feedback';
        restoreQuestionState(state, question);
      }

      const selectedChoice = button.dataset.choice;
      state.activeChoice = selectedChoice;

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
      feedbackArea.classList.remove('incorrect-color');
      feedbackArea.classList.add('correct-color');
      state.correctAnswered = true;

      if (question.prove && !state.proveSolved) {
        state.solved = false;

        showProveActivity(question, state);
      } else {
          state.solved = true;

        applyCorrectAnswerFeedback(question, true);
        updateNavigation(true);
      }

    } else {
      feedbackArea.textContent = '✕';
      feedbackArea.classList.remove('correct-color');
      feedbackArea.classList.add('incorrect-color');

      if (question.prove && !state.proveSolved) {
        const proveArea = document.querySelector('.prove-area');

        if (proveArea) {
          proveArea.classList.add('hidden');
          proveArea.innerHTML = '';
        }
      }

      applyFeedback(choice, question);
    }

    updateChoiceStates(state, question, selectedChoice);
      });
    });
  }

document.getElementById('prevQuestionButton').addEventListener('click', () => {
  if (questionIndex > 0) {
      const targetIndex = questionIndex - 1;

    const sameSet =
      questions[questionIndex].setIndex ===
      questions[targetIndex].setIndex;

    displayQuestion(targetIndex);

    window.scrollTo({
      top: sameSet ? document.documentElement.scrollHeight : 0,
      behavior: 'smooth'
    });
  }
});

document.getElementById('nextQuestionButton').addEventListener('click', () => {
  if (screenMode === 'instructions') {
    screenMode = 'questions';
    displayQuestion(0);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    return;
  }

  if (questionIndex < questions.length - 1) {
    const targetIndex = questionIndex + 1;

    const sameSet =
      questions[questionIndex].setIndex ===
      questions[targetIndex].setIndex;

    displayQuestion(targetIndex);

    window.scrollTo({
      top: sameSet ? document.documentElement.scrollHeight : 0,
      behavior: 'smooth'
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
    
    const translationButton = document.getElementById('translation-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsMenu = document.getElementById('settings-menu');
    const menuExpander = document.getElementById("menu-expander");
    const expandedMenu = document.getElementById("expanded-menu");

    function toggleExpandedMenu() {
      expandedMenu.classList.toggle('menu-visible')
        if (expandedMenu.classList.contains('menu-visible')) {
          menuExpander.textContent = "✕";
        } else {
          menuExpander.textContent = "≡"
        }
        
        if (settingsMenu.classList.contains('menu-visible')) {
          settingsMenu.classList.toggle('menu-visible');
          if (expandedMenu.classList.contains('menu-visible')) {
            menuExpander.textContent = "✕";
          } else {
            menuExpander.textContent = "≡"
          }
        }
    }

    translationButton.addEventListener('click', () => {
      enterTranslationMode();
      toggleExpandedMenu();
    });

    menuExpander.addEventListener('click', () => {
        toggleExpandedMenu();
      }
    )

    const hintButton = document.getElementById("hint-button");

    hintButton.addEventListener('click', () => {
      const question = questions[questionIndex];
      if (!question) return;
      clearVisualState();
      visualMode = 'hint';
      
      // Only allow hint for passage or question, not choices
      // If question text exists OR passage exists (not both undefined)
      const hasPassageOrQuestion = Boolean(question.passage || question.question);

      if (hasPassageOrQuestion) {
        // Show correct feedback visually but do not mark the state solved/correct
        applyCorrectAnswerFeedback(question, false);
      }
      // If the current question/section is "choices" only, do nothing
        menuExpander.textContent = "≡";
        expandedMenu.classList.toggle('menu-visible')
    });

    settingsButton.addEventListener('click', () => {
      expandedMenu.classList.toggle('menu-visible');
      settingsMenu.classList.toggle('menu-visible');
    })

    ensureScrollCue();
    refreshScrollCue();

    window.addEventListener(
      'scroll',
      updateScrollCue,
      { passive: true }
    );

    window.addEventListener(
      'resize',
      refreshScrollCue
    );

  initializeLanguageDropdown();
});

// debug function: skip to question number
window.goToQuestion = function(questionNumber) {
  const targetIndex = Number(questionNumber) - 1;

  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= questions.length
  ) {
    console.warn(
      `Question must be between 1 and ${questions.length}.`
    );
    return;
  }

  screenMode = 'questions';
  displayQuestion(targetIndex);

  window.scrollTo({
    top: 0,
    behavior: 'auto'
  });
};

loadCueContent();