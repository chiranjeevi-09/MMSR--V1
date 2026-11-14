import os
import sys
import io
import datetime
from decimal import Decimal

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.core.files.base import ContentFile
from PIL import Image
from publications.models import Category, Book, Journal, JournalIssue

def generate_placeholder_image(color=(37, 99, 235), text='MMSR'):
    """Generate a clean in-memory PNG image."""
    img = Image.new('RGB', (600, 800), color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def seed_data():
    print("Seeding test categories, book, and journal...")

    # 1. Create Categories
    cat_general, _ = Category.objects.get_or_create(
        name="General Sciences & Engineering",
        defaults={
            "description": "Multidisciplinary scientific and technical publications.",
            "category_type": "all"
        }
    )

    cat_medical, _ = Category.objects.get_or_create(
        name="Medical & Health Sciences",
        defaults={
            "description": "Biomedical and clinical healthcare research.",
            "category_type": "all"
        }
    )

    # 2. Create 1 Book (Price = Rs 1.00)
    book_slug = "mmsr-handbook-of-modern-research-methodologies"
    book = Book.objects.filter(slug=book_slug).first()
    
    if not book:
        print("Creating test book with price = 1.00 INR...")
        book = Book(
            title="MMSR Handbook of Modern Research Methodologies",
            slug=book_slug,
            author="Dr. MMSR Research Council",
            isbn="978-3-16-148410-0",  # Valid checksum
            category=cat_general,
            description="Comprehensive guide to contemporary scientific publication, peer review, and academic research methodologies.",
            price=Decimal("1.00"),
            stock=100,
            published_date=datetime.date(2026, 1, 15),
            is_featured=True,
            pages=320,
            edition="1st Edition",
            rating=Decimal("4.8")
        )
        img_bytes = generate_placeholder_image(color=(30, 58, 138))
        book.cover_image.save("test_book_cover.png", ContentFile(img_bytes), save=False)
        book.save()
        print(f"Book created: {book.title} (ID: {book.public_id}, Price: Rs {book.price})")
    else:
        book.price = Decimal("1.00")
        book.save(update_fields=['price'])
        print(f"Book already exists. Price verified at Rs {book.price}")

    # 3. Create 1 Journal (Annual Subscription = Rs 1.00)
    journal_slug = "mmsr-international-journal-of-applied-sciences"
    journal = Journal.objects.filter(slug=journal_slug).first()

    if not journal:
        print("Creating test journal with price = 1.00 INR...")
        journal = Journal(
            title="MMSR International Journal of Applied Sciences",
            slug=journal_slug,
            issn="0378-5955",  # Valid checksum
            category=cat_general,
            description="Leading peer-reviewed journal covering interdisciplinary breakthroughs in science, computing, and technology.",
            subscription_price_annual=Decimal("1.00"),
            is_featured=True,
            indexed_in="Crossref, Google Scholar, DOAJ",
            frequency="Quarterly",
            access_type="Open Access",
            total_volumes=1,
            total_issues=1
        )
        img_bytes = generate_placeholder_image(color=(16, 185, 129))
        journal.cover_image.save("test_journal_cover.png", ContentFile(img_bytes), save=False)
        journal.save()
        print(f"Journal created: {journal.title} (ID: {journal.public_id}, Price: Rs {journal.subscription_price_annual})")
    else:
        journal.subscription_price_annual = Decimal("1.00")
        journal.save(update_fields=['subscription_price_annual'])
        print(f"Journal already exists. Price verified at Rs {journal.subscription_price_annual}")

    # 4. Create an Issue for the Journal (Issue Price = Rs 1.00)
    issue = JournalIssue.objects.filter(journal=journal, volume_number=1, issue_number=1).first()
    if not issue:
        print("Creating test journal issue with price = 1.00 INR...")
        issue = JournalIssue(
            journal=journal,
            title="Volume 1, Issue 1 (Inaugural Edition)",
            volume_number=1,
            issue_number=1,
            publication_date=datetime.date(2026, 2, 1),
            price=Decimal("1.00"),
            price_print=Decimal("1.00"),
            stock=50
        )
        img_bytes = generate_placeholder_image(color=(5, 150, 105))
        issue.cover_image.save("test_issue_cover.png", ContentFile(img_bytes), save=False)
        issue.save()
        print(f"Journal Issue created: {issue.title} (Price: Rs {issue.price})")
    else:
        issue.price = Decimal("1.00")
        issue.price_print = Decimal("1.00")
        issue.save(update_fields=['price', 'price_print'])
        print(f"Journal Issue verified at Rs {issue.price}")

    print("\n✅ Seed completed successfully! All items set to 1.00 INR for live testing.")

if __name__ == '__main__':
    seed_data()
