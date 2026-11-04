# Valoda

PWA для активного словаря латышского: короткие сессии, FSRS, офлайн.
Основа решений — [research/lang-app-research.md](research/lang-app-research.md), архитектура — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Команды

```bash
npm install
npm run dev            # http://localhost:5173/valoda-app/
npm run build
npm run tts:voicetest  # слепой тест голосов → public/voice-test/
npm run content:check  # словарь Tēzaurs + проверка естественности по интернету → статусы фраз
npm run tts:generate   # озвучка только фраз со статусом «ок»
```

## Правило для фраз (обязательно для любой новой или изменённой фразы)

1. Фраза добавляется или меняется только в `content/<lang>/phrases.src.json` (переводы слов — в `lexicon.src.json`).
2. Сразу после этого запускается `npm run content:check`. Он:
   - проверяет каждое слово по словарю Tēzaurs и разбирает его (`build_phrases.py`), ошибка словаря — фраза не собирается;
   - ищет фразу в корпусе korpuss.lv (LVK2022), а если её там нет — каждое сочетание соседних слов; ищет точное предложение в Tatoeba;
   - делает обратный перевод на русский двумя независимыми переводчиками (Google и Microsoft Azure Translator) и сверяет с нашим переводом;
   - проверяет типичные ошибки ИИ (например, «nav» + не родительный падеж);
   - пишет доказательства и статус в `content/<lang>/auto-check.json`. Статус привязан к точному тексту и переводу: изменённая фраза проверяется заново сама.
3. Статусы: «ок» — найдено у носителей и оба перевода совпадают; «сомнительно» — с причинами; «убрать». Без найденного источника «ок» не ставится. Ручные решения по сомнительным — в `content/<lang>/check-notes.json`. Пометка может убрать фразу или признать синоним в переводе, но не заменит отсутствующий источник.
4. В тренировки попадают и озвучиваются только фразы «ок» (или проверенные репетитором). Озвучка — `npm run tts:generate`: она озвучивает только новые или изменённые тексты.
5. Для второго переводчика в `.env` нужны `AZURE_TRANSLATOR_KEY` и `AZURE_TRANSLATOR_REGION` (Azure Translator, бесплатный тариф F0). Без ключа все фразы остаются «сомнительно».

## Ключи для озвучки

Скопируй `scripts/tts/env.template` в `.env` в корне проекта и впиши ключи. `.env` в git не попадает.

Piper (бесплатно, локально) ставится в venv по пути без кириллицы:

```bash
python -m venv %USERPROFILE%\.venvs\valoda-tts
%USERPROFILE%\.venvs\valoda-tts\Scripts\python -m pip install piper-tts
%USERPROFILE%\.venvs\valoda-tts\Scripts\python -m piper.download_voices lv_LV-aivars-medium --data-dir data-cache/piper
```

## Данные и лицензии

- Словарь: Tēzaurs.lv 2026 (Autumn Edition), LU MII — CC BY-SA 4.0, CLARIN-LV handle 20.500.12574/162.
- Голос Piper `lv_LV-aivars-medium`: датасет CC0; движок piper-tts — GPL-3.0 (используется только как инструмент для генерации аудио).
