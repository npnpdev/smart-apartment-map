from django.db import migrations, models


USUN_DUPLIKATY = """
    DELETE FROM api_educationfacility a
    USING api_educationfacility b
    WHERE a.id > b.id AND a.location = b.location;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_alter_apartment_location_and_more'),
    ]

    operations = [
        migrations.RunSQL(USUN_DUPLIKATY, migrations.RunSQL.noop),
        migrations.AddConstraint(
            model_name='educationfacility',
            constraint=models.UniqueConstraint(fields=('location',), name='uniq_education_location'),
        ),
    ]
