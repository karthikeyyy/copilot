// ==============================================================================
// ComUcate — Instagram Lexical Editor Bridge
// Runs in the MAIN world (page context) with direct access to DOM expando
// properties, specifically composer.__lexicalEditor.
// ==============================================================================

(() => {
  if (window.__COMUCATE_LEXICAL_BRIDGE_LOADED__) return;
  window.__COMUCATE_LEXICAL_BRIDGE_LOADED__ = true;

  console.log("[ComUcate Bridge] Initialized in MAIN world");

  // SPA Navigation hooks to detect chat switches immediately
  try {
    const origPushState = history.pushState;
    history.pushState = function (...args) {
      const result = origPushState.apply(this, args);
      window.dispatchEvent(new CustomEvent("comucate_navigation"));
      return result;
    };

    const origReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = origReplaceState.apply(this, args);
      window.dispatchEvent(new CustomEvent("comucate_navigation"));
      return result;
    };

    window.addEventListener("popstate", () => {
      window.dispatchEvent(new CustomEvent("comucate_navigation"));
    });
  } catch (err) {
    console.warn("[ComUcate Bridge] History hook error:", err);
  }

  function findInstagramComposer() {
    const selectors = [
      "div[contenteditable='true'][data-lexical-editor='true']",
      "main div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][aria-label*='Message']"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 0) {
        return el;
      }
    }
    return null;
  }

  function getEditor(composer) {
    if (!composer) return null;
    return composer.__lexicalEditor || null;
  }

  function buildLexicalParagraphs(text) {
    if (!text) {
      return [{
        children: [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1
      }];
    }

    const lines = String(text).split("\n");
    return lines.map((line) => ({
      children: line ? [{
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: line,
        type: "text",
        version: 1
      }] : [],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "paragraph",
      version: 1
    }));
  }

  function setLexicalState(editor, text) {
    const children = buildLexicalParagraphs(text);
    const stateObj = {
      root: {
        children,
        direction: text ? "ltr" : null,
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };

    const parsed = editor.parseEditorState(stateObj);
    editor.setEditorState(parsed);
  }

  function fallbackNativeEdit(composer, text) {
    composer.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.removeAllRanges();
    selection.addRange(range);

    if (!text) {
      // Clear
      document.execCommand("delete", false, null);
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "deleteContentBackward"
      }));
    } else {
      // Replace with text
      const success = document.execCommand("insertText", false, text);
      if (!success) {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        const pasteEvt = new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        composer.dispatchEvent(pasteEvt);
      }
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text
      }));
    }
  }

  window.addEventListener("comucate_lexical_action", (e) => {
    const { id, action, text } = e.detail || {};
    const composer = findInstagramComposer();

    if (!composer) {
      window.dispatchEvent(new CustomEvent("comucate_lexical_response", {
        detail: { id, success: false, error: "composer_not_found" }
      }));
      return;
    }

    composer.focus();
    const editor = getEditor(composer);
    let usedMethod = "native_fallback";

    if (editor && typeof editor.parseEditorState === "function" && typeof editor.setEditorState === "function") {
      try {
        if (action === "CLEAR") {
          setLexicalState(editor, "");
        } else {
          setLexicalState(editor, text || "");
        }
        usedMethod = "lexical_setEditorState";
      } catch (err) {
        console.warn("[ComUcate Bridge] Lexical API call error, falling back:", err);
        fallbackNativeEdit(composer, action === "CLEAR" ? "" : text);
      }
    } else {
      fallbackNativeEdit(composer, action === "CLEAR" ? "" : text);
    }

    // Wait a tick for editor reconciliation, then verify actual text
    setTimeout(() => {
      const currentText = (composer.innerText || "").replace(/\u200B/g, "").trim();
      let verified = false;

      if (action === "CLEAR") {
        verified = (currentText === "");
        if (!verified && currentText.length > 0) {
          // Extra attempt if not clean
          fallbackNativeEdit(composer, "");
        }
      } else {
        // Must contain the text or be non-empty
        verified = (currentText.length > 0);
      }

      const finalCheck = (composer.innerText || "").replace(/\u200B/g, "").trim();
      const isSuccess = action === "CLEAR" ? (finalCheck === "") : (finalCheck.length > 0);

      window.dispatchEvent(new CustomEvent("comucate_lexical_response", {
        detail: {
          id,
          success: isSuccess,
          currentText: finalCheck,
          method: usedMethod
        }
      }));
    }, 40);
  });
})();
