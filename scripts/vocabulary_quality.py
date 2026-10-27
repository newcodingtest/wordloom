"""Editorial overrides and conservative formatting checks (not a translation oracle)."""
import csv
import re


def normalize_meaning(value):
    """Standardize synonym separators without splitting explanatory parentheses."""
    parts, current, depth = [], [], 0
    for char in value:
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        if char in ',;' and depth == 0:
            parts.append(''.join(current))
            current = []
        else:
            current.append(char)
    parts.append(''.join(current))
    return '; '.join(dict.fromkeys(' '.join(p.split()) for p in parts if p.strip()))


def load_review(root):
    result = {}
    with (root / 'data/sources/meaning-review.tsv').open(encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter='\t')
        if reader.fieldnames != ['word', 'meaning']:
            raise ValueError('Invalid meaning review columns')
        for row in reader:
            word, meaning = row['word'], row['meaning']
            if not word or not meaning or word in result or None in row:
                raise ValueError(f'Invalid or duplicate editorial correction: {word}')
            validate_meaning(meaning, word)
            result[word] = meaning
    return result


def validate_meaning(value, label):
    if not isinstance(value, str) or not re.search('[가-힣]', value):
        raise ValueError(f'{label}: missing Korean meaning')
    if re.search(r'Korean:|omit it|TODO|번역 필요|뜻 없음|미정|[<>\[\]�ᄀ-ᇿ]', value, re.I):
        raise ValueError(f'{label}: editorial artifact in meaning')
    depth = 0
    for char in value:
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        if depth < 0:
            raise ValueError(f'{label}: unbalanced meaning parentheses')
    if depth:
        raise ValueError(f'{label}: unbalanced meaning parentheses')
    if normalize_meaning(value) != value:
        raise ValueError(f'{label}: duplicate synonyms or noncanonical meaning separators')
