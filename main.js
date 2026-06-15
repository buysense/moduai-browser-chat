import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const SYSTEM_PROMPT = [
  "You are a concise Korean AI demo assistant for ModuAI.",
  "Explain AI agents, SMS interfaces, and browser-based AI in simple Korean.",
  "Keep answers under 5 short sentences.",
].join(" ");

const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chatForm");
const inputEl = document.querySelector("#promptInput");
const sendButtonEl = document.querySelector("#sendButton");
const statusTextEl = document.querySelector("#statusText");
const statusDotEl = document.querySelector("#statusDot");
const chips = document.querySelectorAll("[data-prompt]");

let engine;
let isBusy = false;
const chatHistory = [{ role: "system", content: SYSTEM_PROMPT }];

function setStatus(text, state = "loading") {
  statusTextEl.textContent = text;
  statusDotEl.classList.toggle("ready", state === "ready");
  statusDotEl.classList.toggle("error", state === "error");
}

function setInputEnabled(enabled) {
  inputEl.disabled = !enabled;
  sendButtonEl.disabled = !enabled || isBusy;
  chips.forEach((chip) => {
    chip.disabled = !enabled || isBusy;
  });
}

function appendMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "ME" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  article.append(avatar, bubble);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function hasWebGPU() {
  return Boolean(navigator.gpu);
}

async function initEngine() {
  inputEl.disabled = true;
  setStatus("환경 확인 중");

  if (!hasWebGPU()) {
    setStatus("WebGPU 미지원", "error");
    appendMessage(
      "assistant",
      "이 브라우저에서는 로컬 AI 실행에 필요한 WebGPU를 사용할 수 없습니다. 최신 Chrome 또는 Edge에서 다시 열어보세요."
    );
    return;
  }

  try {
    setStatus("모델 로딩 준비 중");
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        const text = report?.text || "모델을 로딩하고 있습니다";
        setStatus(text);
      },
    });

    setStatus("실행 준비 완료", "ready");
    setInputEnabled(true);
  } catch (error) {
    console.error(error);
    setStatus("로딩 실패", "error");
    appendMessage(
      "assistant",
      "모델 로딩에 실패했습니다. 브라우저, GPU 지원 여부, 네트워크 상태에 따라 실행이 제한될 수 있습니다."
    );
  }
}

async function runPrompt(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed || !engine || isBusy) return;

  isBusy = true;
  setInputEnabled(false);
  appendMessage("user", trimmed);
  inputEl.value = "";

  const assistantBubble = appendMessage("assistant", "생각 중입니다...");
  chatHistory.push({ role: "user", content: trimmed });

  try {
    const stream = await engine.chat.completions.create({
      messages: chatHistory.slice(-9),
      temperature: 0.7,
      stream: true,
    });

    let response = "";
    for await (const chunk of stream) {
      response += chunk.choices[0]?.delta?.content || "";
      assistantBubble.textContent = response || "응답 생성 중입니다...";
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    const finalResponse = response.trim() || "응답을 생성하지 못했습니다.";
    assistantBubble.textContent = finalResponse;
    chatHistory.push({ role: "assistant", content: finalResponse });
  } catch (error) {
    console.error(error);
    assistantBubble.textContent =
      "응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해보세요.";
  } finally {
    isBusy = false;
    setInputEnabled(true);
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  runPrompt(inputEl.value);
});

inputEl.addEventListener("input", () => {
  sendButtonEl.disabled = !inputEl.value.trim() || !engine || isBusy;
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    runPrompt(chip.dataset.prompt || "");
  });
});

setInputEnabled(false);
initEngine();
