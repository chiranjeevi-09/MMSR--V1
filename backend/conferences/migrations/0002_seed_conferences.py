from django.db import migrations


SEED_CONFERENCES = [
    {
        'slug': 'icai-2026',
        'title': 'International Conference on Artificial Intelligence & Quantum Computing (ICAI-2026)',
        'acronym': 'ICAI-2026',
        'description': 'Bringing together global scholars, AI pioneers, and quantum computing researchers to explore neural architectures, quantum algorithms, and autonomous systems.',
        'full_description': 'The International Conference on Artificial Intelligence & Quantum Computing (ICAI-2026) is a premier global forum presenting novel research in generative models, quantum hardware integration, machine learning ethics, and high-performance computing.',
        'start_date': '2026-11-15',
        'end_date': '2026-11-17',
        'venue': 'Imperial College London & Hybrid Portal',
        'country': 'United Kingdom',
        'mode': 'Hybrid',
        'status': 'Upcoming',
        'domain': 'Computer Science & AI',
        'organizer': 'MMSR Publications & Global AI Research Council',
        'registration_open': True,
        'is_accepting_submissions': True,
        'submission_deadline': '2026-10-15',
        'doi_prefix': '10.5555/icai2026',
        'isbn_proceedings': '978-93-98765-01-2',
        'tracks': [
            {'id': 'ai-ml', 'title': 'Artificial Intelligence & Machine Learning', 'description': '', 'topics': ['Deep Learning', 'Generative Models']},
            {'id': 'quantum', 'title': 'Quantum Computing', 'description': '', 'topics': ['Quantum Algorithms']},
        ],
    },
    {
        'slug': 'icest-2026',
        'title': 'International Conference on Environmental Science & Sustainable Technology (ICEST-2026)',
        'acronym': 'ICEST-2026',
        'description': 'Focusing on clean energy innovations, climate resilience modeling, renewable materials, and sustainable industrial ecology.',
        'full_description': 'ICEST-2026 convenes environmental scientists, chemical engineers, and sustainability policy directors to address global climate challenges through technological breakthroughs.',
        'start_date': '2026-10-22',
        'end_date': '2026-10-24',
        'venue': 'ETH Zurich Center',
        'country': 'Switzerland',
        'mode': 'Offline',
        'status': 'Upcoming',
        'domain': 'Life Sciences & Environment',
        'organizer': 'MMSR Green Science Initiative',
        'registration_open': True,
        'is_accepting_submissions': True,
        'submission_deadline': '2026-09-30',
        'doi_prefix': '10.5555/icest2026',
        'isbn_proceedings': '978-93-98765-02-9',
        'tracks': [
            {'id': 'renewables', 'title': 'Renewable Energy', 'description': '', 'topics': ['Solar', 'Wind']},
            {'id': 'climate', 'title': 'Climate Resilience', 'description': '', 'topics': ['Modeling']},
        ],
    },
    {
        'slug': 'icams-2026',
        'title': 'Global Summit on Advanced Materials & Nanotechnology (ICAMS-2026)',
        'acronym': 'ICAMS-2026',
        'description': 'Exploring 2D materials, semiconductor nanostructures, biomaterials for drug delivery, and next-generation energy storage.',
        'full_description': 'ICAMS-2026 provides a high-level platform for materials scientists, physicists, and nanotechnologists to present breakthrough peer-reviewed research papers.',
        'start_date': '2026-12-05',
        'end_date': '2026-12-07',
        'venue': 'Tokyo Virtual Academic Hall',
        'country': 'Japan',
        'mode': 'Online',
        'status': 'Upcoming',
        'domain': 'Physics & Nanotechnology',
        'organizer': 'MMSR Publications & International Nanotech Society',
        'registration_open': True,
        'is_accepting_submissions': True,
        'submission_deadline': '2026-11-01',
        'doi_prefix': '10.5555/icams2026',
        'isbn_proceedings': '978-93-98765-03-6',
        'tracks': [
            {'id': 'nanotech', 'title': 'Nanotechnology', 'description': '', 'topics': ['2D Materials']},
            {'id': 'energy', 'title': 'Energy Storage', 'description': '', 'topics': ['Batteries', 'Supercapacitors']},
        ],
    },
]


def seed_conferences(apps, schema_editor):
    from django.conf import settings
    # AUDIT DB-03: Never seed dummy/placeholder conferences into production.
    # Only runs when SEED_DEV_DATA is explicitly enabled in settings/environment.
    if getattr(settings, 'SEED_DEV_DATA', False):
        Conference = apps.get_model('conferences', 'Conference')
        for data in SEED_CONFERENCES:
            Conference.objects.update_or_create(slug=data['slug'], defaults=data)


def reverse_seed(apps, schema_editor):
    Conference = apps.get_model('conferences', 'Conference')
    Conference.objects.filter(slug__in=[c['slug'] for c in SEED_CONFERENCES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('conferences', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_conferences, reverse_seed),
    ]
