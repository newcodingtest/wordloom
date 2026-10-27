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

## 2026-10-27 한국어 뜻 전량 검토 및 교정

- Codex가 배포 중인 6,500개 영어·한국어 쌍을 알파벳 순으로 모두 읽고 의미 대응과 학습용 표현을 검토했다. 독립된 전문 번역가의 전수 감수는 아니다.
- `meaning-review.tsv`는 이번 편집 교정표다. 기존 `corrections.json`보다 우선 적용하며 1,534개 항목을 고정한다. 기존 값과 다른 의미·표현 교정은 1,533개이며, 나머지 1개는 이미 같았던 값을 회귀 방지 대상으로 유지한다.
- 원본 영문 정의와 대조하여 핵심 의미 누락, 속어만 남은 뜻, 잘못된 품사 표현, 깨진 문구를 직접 다시 작성했다. 동일 뜻의 반복을 제거하고 쉼표·세미콜론을 정규화했다. 전체 사전의 정의나 예문을 새로 크롤링하지 않았다.
- 의미 범위 확인에 추가로 참고한 항목: [midge](https://en.wiktionary.org/wiki/midge), [cedar](https://en.wiktionary.org/wiki/cedar), [turnover](https://en.wiktionary.org/wiki/turnover), [manslaughter](https://www.law.cornell.edu/wex/manslaughter). 확인일: 2026-10-27. 정의 전문을 복제하지 않고 한국어 설명을 작성했다.
- 기존 출처 표시를 유지한 CC BY-SA 4.0 파생 데이터이며, 편집 교정표도 같은 조건으로 제공한다. 원본과 다른 편집 내용은 Wordloom의 변경 사항이다.
- 변경 전후 3,709개 항목과 검토한 팩의 SHA-256은 `../../verification/meaning-review.json`에 기록했다. 자동 검사는 알려진 오류의 재유입과 형식 오류를 차단하지만 번역 오류가 전혀 없음을 보증하지 않는다.
