"""Project-wide field validation rules (authoritative layer).

Frontend helpers live in ``lib/validation/index.ts`` and mirror these rules —
but the values below are the contract the API enforces, because client-side
``maxLength``/``pattern`` attributes protect nothing (see GLOBAL INPUT
VALIDATION spec, Phase K).

Design rules:
  * Phone / PIN / ISBN are IDENTIFIERS: validated as strings, never as
    quantities, and never silently truncated or digit-stripped into a
    different value. Input containing letters or stray symbols is REJECTED
    rather than cleaned.
  * Normalization is deliberately narrow: spaces, dashes, parentheses and a
    leading ``+91``/``0`` country/trunk prefix may be written by users; after
    removing those separators the value must still match the documented rule.
  * Functions raise ``rest_framework.serializers.ValidationError`` so DRF
    returns structured ``{"field": ["message"]}`` bodies the frontend renders
    inline.
"""
import re
import unicodedata

from rest_framework import serializers

# Standard Indian mobile: exactly 10 digits starting 6-9.
INDIAN_MOBILE_RE = re.compile(r'^[6-9]\d{9}$')

# Separators that may legitimately appear while typing a phone number.
_PHONE_ALLOWED_CHARS_RE = re.compile(r'^[\d\s+\-().]+$')

# Indian postal PIN: 6 digits, first digit non-zero.
INDIAN_PIN_RE = re.compile(r'^[1-9]\d{5}$')

# Generic international postcode fallback (addresses may hold non-Indian
# codes: UK/US ZIPs etc.) — kept deliberately permissive but malformed-free.
POSTCODE_GENERIC_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9\- ]{2,19}$')

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def normalize_indian_mobile(raw, *, field_label='Phone number', required=True, raise_error=True):
    """Return bare 10 digits, or raise/'' per options.

    Rejects alphabetic/symbol input outright (no silent digit-stripping) and
    rejects length/format violations. Accepts the common written forms:
    ``9876543210``, ``+91 98765 43210``, ``09876543210``, ``(98765) 43210``.
    """
    value = (raw or '').strip()
    if not value:
        if required:
            if raise_error:
                raise serializers.ValidationError(f'{field_label} is required.')
            return None
        return ''
    if not _PHONE_ALLOWED_CHARS_RE.match(value):
        msg = f'{field_label} may contain digits (and an optional +91 prefix) only — no letters or symbols.'
        if raise_error:
            raise serializers.ValidationError(msg)
        return None
    digits = re.sub(r'\D', '', value)
    if len(digits) > 10:
        # Tolerate exactly a country code (+91) or trunk prefix (0) in front.
        if digits.startswith('91') and len(digits) in (11, 12):
            digits = digits[2:]
        elif digits.startswith('0') and len(digits) == 11:
            digits = digits[1:]
    if not INDIAN_MOBILE_RE.match(digits):
        msg = f'{field_label} must be a 10-digit Indian mobile number (starting 6-9).'
        if raise_error:
            raise serializers.ValidationError(msg)
        return None
    return digits


def validate_phone_number(value, field_label='Phone number'):
    """Required-or-blank-dependent Indian mobile check for serializer fields.

    Use on fields where a value, if present, must be a valid mobile; blank is
    preserved for genuinely optional fields via the caller's own required flag.
    """
    if value in (None, ''):
        return value
    return normalize_indian_mobile(value, field_label=field_label)


def validate_optional_indian_pin(value, field_label='PIN code'):
    """Blank allowed; when present must look like a postcode of any country
    (6-digit Indian PINs pass; foreign ZIP/postcodes are not rejected)."""
    value = (value or '').strip()
    if not value:
        return value
    if INDIAN_PIN_RE.match(value) or POSTCODE_GENERIC_RE.match(value):
        return value
    raise serializers.ValidationError(
        f'{field_label} must be 6 digits for Indian addresses (or a valid international postcode).'
    )


def validate_isbn(value, field_label='ISBN'):
    """Optional ISBN-10/13 with checksum verification (identifier, not number)."""
    value = (value or '').strip()
    if not value:
        return value
    compact = value.replace('-', '').replace(' ', '').upper()
    if not re.match(r'^(\d{9}[\dX]|\d{13})$', compact):
        raise serializers.ValidationError(f'{field_label} must be a valid ISBN-10 or ISBN-13.')
    if len(compact) == 10:
        total = sum((i + 1) * (10 if c == 'X' else int(c)) for i, c in enumerate(compact))
        ok = total % 11 == 0
    else:
        total = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(compact[:12]))
        ok = (10 - total % 10) % 10 == int(compact[12])
    if not ok:
        raise serializers.ValidationError(f'{field_label} checksum is invalid — re-check the digits.')
    return value


def validate_issn(value, field_label='ISSN'):
    """Optional ISSN (8 digits, last may be an X check digit) with checksum.

    Like ISBN this is an IDENTIFIER: it is validated as a string and never
    coerced to a number. Blank passes (journals may be pre-assigned).
    """
    value = (value or '').strip()
    if not value:
        return value
    compact = value.replace('-', '').replace(' ', '').upper()
    if not re.match(r'^\d{7}[\dX]$', compact):
        raise serializers.ValidationError(f'{field_label} must be 8 digits (format ####-####).')
    total = sum((8 - i) * (10 if c == 'X' else int(c)) for i, c in enumerate(compact[:7]))
    check = (11 - total % 11) % 11
    check_char = 'X' if check == 10 else str(check)
    if check_char != compact[7]:
        raise serializers.ValidationError(f'{field_label} checksum is invalid — re-check the digits.')
    return value


def validate_alpha_text(value, field_label='This field', *, required=False, min_len=2, max_len=100):
    """Person / place name validator (first/last/full name, city, state, country).

    Letters of any script, spaces and a small set of name separators
    (hyphen, apostrophe, period, comma) are allowed. Digits and stray symbols
    such as ``@``, ``#``, ``/`` are REJECTED — previously only digits were, so
    letters-only fields still accepted punctuation/symbols (audit M-10).
    Non-ASCII letters (e.g. "José Núñez", "ललित") stay valid because ``str.isalpha()``
    is Unicode-aware. Blank is preserved for genuinely optional fields via the
    caller's own ``required`` flag. Raises a structured DRF error.
    """
    value = (value or '').strip()
    if not value:
        if required:
            raise serializers.ValidationError(f'{field_label} is required.')
        return value
    if re.search(r'\d', value):
        raise serializers.ValidationError(
            f'{field_label} must contain letters only — numbers are not allowed.'
        )
    # Any character that is not a (Unicode) letter, whitespace, or an approved
    # name separator is a disallowed symbol. Combining marks are permitted so
    # decomposed (NFD) accented letters such as "e\u0301" stay valid.
    for ch in value:
        if ch.isalpha() or ch.isspace() or ch in "'-.,":
            continue
        if unicodedata.category(ch).startswith('M'):
            continue
        raise serializers.ValidationError(
            f'{field_label} must contain letters only — symbols such as "@", "#", "/" are not allowed.'
        )
    if len(value) < min_len:
        raise serializers.ValidationError(f'{field_label} must be at least {min_len} characters.')
    if len(value) > max_len:
        raise serializers.ValidationError(f'{field_label} must be at most {max_len} characters.')
    return value


def validate_email_format(value, field_label='Email address'):
    value = (value or '').strip()
    if not EMAIL_RE.match(value):
        raise serializers.ValidationError(f'Enter a valid {field_label.lower()}.')
    return value


def validate_document_file(
    file_obj,
    *,
    field_label='Document',
    max_size_bytes=10 * 1024 * 1024,
    allowed_extensions=('pdf', 'doc', 'docx'),
):
    """Validate uploaded document file for extension, size, filename security, and magic bytes.

    Protects against:
    - Path traversal and malicious filenames
    - Oversized files exceeding max_size_bytes
    - Disallowed file extensions
    - Executable/HTML files spoofing document extensions (magic-byte validation)
    """
    if not file_obj:
        return file_obj

    # 1. Filename sanitization / path traversal check
    filename = getattr(file_obj, 'name', '') or ''
    if not filename:
        raise serializers.ValidationError(f'{field_label} filename is invalid.')
    if '..' in filename or '/' in filename or '\\' in filename:
        raise serializers.ValidationError(f'{field_label} filename must not contain directory traversal characters.')

    # 2. Extension check
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    normalized_allowed = [e.lstrip('.').lower() for e in allowed_extensions]
    if ext not in normalized_allowed:
        allowed_str = ', '.join(f'.{e}' for e in normalized_allowed)
        raise serializers.ValidationError(
            f'{field_label} must be a valid document ({allowed_str}).'
        )

    # 3. File size check
    size = getattr(file_obj, 'size', 0)
    if size > max_size_bytes:
        mb = max_size_bytes // (1024 * 1024)
        actual_mb = size / (1024 * 1024)
        raise serializers.ValidationError(
            f'{field_label} must not exceed {mb} MB (yours is {actual_mb:.1f} MB).'
        )

    # 4. Magic byte signature verification
    # Read up to 8 bytes and restore the file pointer so subsequent saves work seamlessly
    try:
        pos = file_obj.tell() if hasattr(file_obj, 'tell') else 0
        header = file_obj.read(8)
        if hasattr(file_obj, 'seek'):
            file_obj.seek(pos)
    except Exception:
        header = b''

    if ext == 'pdf':
        if not header.startswith(b'%PDF-'):
            raise serializers.ValidationError(
                f'{field_label} content does not match a valid PDF file.'
            )
    elif ext == 'docx':
        # DOCX is an Open Packaging Convention (ZIP archive)
        if not header.startswith(b'PK\x03\x04'):
            raise serializers.ValidationError(
                f'{field_label} content does not match a valid Word (.docx) document.'
            )
    elif ext == 'doc':
        # Legacy DOC is Compound File Binary (CFB) format
        if not header.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
            raise serializers.ValidationError(
                f'{field_label} content does not match a valid Word (.doc) document.'
            )

    return file_obj


def validate_image_file(file_obj, *, field_label='Image', max_width=4000, max_height=4000, max_size_bytes=10 * 1024 * 1024):
    """Validate uploaded image file for extension, content, dimensions, and decompression safety."""
    from core.image_processing import validate_public_image_upload
    return validate_public_image_upload(file_obj, max_width=max_width, max_height=max_height, max_size=max_size_bytes)
