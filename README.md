# Valoda

PWA для активного словаря латышского: короткие сессии, FSRS, офлайн.
Основа решений — [research/lang-app-research.md](research/lang-app-research.md), архитектура — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Команды

```bash
npm install
npm run dev            # http://localhost:5173/valoda-app/
npm run build
npm run tts:voicetest  # слепой тест голосов → public/voice-test/
```

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
