import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from vocabulary_quality import normalize_meaning, validate_meaning


class MeaningQualityTests(unittest.TestCase):
    def test_cleanup_preserves_explanatory_context(self):
        source = '  뜻, 의미; 뜻; 설명(분야, 문맥); 설명(분야, 문맥) '
        result = normalize_meaning(source)
        self.assertEqual(result, '뜻; 의미; 설명(분야, 문맥)')
        self.assertEqual(normalize_meaning(result), result)
        validate_meaning(result, 'example')

    def test_broken_explanations_and_editor_notes_are_rejected(self):
        for meaning in ['뜻)', '뜻(설명', 'Korean: 뜻', '뜻; or simply omit it.', '뜻; 뜻', '뜻; ᆯ 것 같다']:
            with self.subTest(meaning=meaning), self.assertRaises(ValueError):
                validate_meaning(meaning, 'example')
