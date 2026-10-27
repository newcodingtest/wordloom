# 데이터 출처 및 변경 공지

## koreader-en-ko-v1.2.0
- KOReader Dicts, Daniel Gregorini 및 기여자: https://github.com/DanielGregorini/koreader-dicts/releases/tag/v1.2.0
- 원본: https://github.com/DanielGregorini/koreader-dicts/releases/download/v1.2.0/en-ko.zip
- 취득일: 2026-10-26. 원본 빌드일: 2026-09-11. SHA-256: conversion-report.json 참조.
- English Wiktionary 기여자, kaikki.org / wiktextract. https://en.wiktionary.org/ 및 https://kaikki.org/
- Princeton University WordNet 3.0: https://wordnet.princeton.edu/license-and-commercial-use
- 파생 데이터 팩 전체: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
- 원본 ZIP과 내부 ATTRIBUTION, LICENSE, README.txt를 original/en-ko/에 보존한다. WordNet 고지는 WORDNET-LICENSE.txt에 추가 보존한다.
- 변경: StarDict headword만 변환, HTML 및 한자 괄호 제거, 빈도 선정, 부적절한 용례/활용형 제외, 품사 기반 분류, 빈도 순위 기반 교육용 레벨, 일부 한국어 뜻 교정. 원본 예문/영어 정의 미포함. .syn 굴절형은 읽지 않는다.
- 이 데이터는 ETS 공식 목록이 아니다. 토플 준비를 위한 일반 독해 어휘 선정이다. 레벨은 CEFR 또는 시험 출제 빈도 등급이 아니다.

## 선정용 빈도
Hermit Dave 및 FrequencyWords 기여자, OpenSubtitles 2018 영어 50k:
https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/en/en_50k.txt
콘텐츠 CC BY-SA 4.0, 코드 MIT. frequency-README.md / frequency-LICENSE 보존.
빈도는 학술 중요도와 동일하지 않으며 일반 독해 기반 선정에만 사용한다.

## 품질 기록
qa-sample.json은 레벨/분류별 층화 표본이다. 자동 검사는 정확한 번역 전체를 보장하지 않는다.
수정 내역과 출시 판정은 QA.md 및 ../../IMPLEMENTATION_REPORT.md 참조.
