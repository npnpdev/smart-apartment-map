from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

# wersjonowanie
class DataVersion(models.Model):
   
    version_number = models.PositiveIntegerField(unique=True)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    items_seen = models.PositiveIntegerField(default=0)
    items_new = models.PositiveIntegerField(default=0)
    items_updated = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-version_number"]

    def __str__(self):
        return f"v{self.version_number} ({self.created_at:%Y-%m-%d %H:%M})"

# dzielnica
class District(models.Model):

    name = models.CharField(max_length=100, unique=True)
    name_de = models.CharField(max_length=100, blank=True)
    osm_relation_id = models.BigIntegerField(null=True, blank=True, unique=True)
    wikidata_id = models.CharField(max_length=20, blank=True)
    geometry = gis_models.MultiPolygonField(srid=4326, spatial_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

# halas
class NoiseZone(models.Model):

    object_id = models.IntegerField(unique=True, help_text="OBJECTID z geojson")
    min_db = models.PositiveSmallIntegerField()
    max_db = models.PositiveSmallIntegerField()
    geometry = gis_models.MultiPolygonField(srid=4326, spatial_index=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["min_db"]
        indexes = [
            models.Index(fields=["min_db", "max_db"]),
        ]

    def __str__(self):
        return f"NoiseZone {self.object_id}: {self.min_db};{self.max_db} dB"


# mieszkania
class Apartment(models.Model):

    external_id = models.CharField(max_length=255, help_text="ID ogłoszenia z portalu źródłowego")
    source_portal = models.CharField(max_length=50)
    source_url = models.URLField(max_length=1000, blank=True)
    #treść ogłoszenia 
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    offer_type = models.CharField(
        max_length=20,
        choices=[("rent", "Wynajem"), ("sale", "Sprzedaż")],
        default="rent",
    )

    price = models.DecimalField(max_digits=12, decimal_places=2)
    area = models.DecimalField(max_digits=8, decimal_places=2)
    rooms = models.PositiveSmallIntegerField(null=True, blank=True)
    floor = models.SmallIntegerField(null=True, blank=True)
    year_built = models.PositiveSmallIntegerField(null=True, blank=True)
    has_elevator = models.BooleanField(null=True)
    is_accessible = models.BooleanField(null=True,)
    location = gis_models.PointField(srid=4326, spatial_index=True)
    address = models.CharField(max_length=500, blank=True)
    district = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="apartments",
    )

    noise_db_min = models.PositiveSmallIntegerField(null=True, blank=True)
    noise_db_max = models.PositiveSmallIntegerField(null=True, blank=True)

    first_seen_in = models.ForeignKey(
        DataVersion,
        on_delete=models.PROTECT,
        related_name="new_apartments",
    )
    last_updated_in = models.ForeignKey(
        DataVersion,
        on_delete=models.PROTECT,
        related_name="updated_apartments",
    )
    is_active = models.BooleanField(default=True)

    VALIDATION_CHOICES = [
        ("valid", "Valid"),
        ("suspicious", "Suspicious"),
        ("invalid", "Invalid"),
    ]
    validation_status = models.CharField(
        max_length=20,
        choices=VALIDATION_CHOICES,
        default="valid",
    )
    validation_notes = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["external_id", "source_portal"],
                name="uniq_apartment_per_portal",
            ),
        ]
        indexes = [
            models.Index(fields=["district", "is_active"]),
            models.Index(fields=["price"]),
            models.Index(fields=["validation_status", "is_active"]),
            models.Index(fields=["offer_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.price} PLN)"

    @property
    def price_per_m2(self):
        if self.area and self.area > 0:
            return round(float(self.price) / float(self.area), 2)
        return None


# historia zmian
class ApartmentHistory(models.Model):

    apartment = models.ForeignKey(
        Apartment, on_delete=models.CASCADE, related_name="history"
    )
    version = models.ForeignKey(DataVersion, on_delete=models.PROTECT)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    area = models.DecimalField(max_digits=8, decimal_places=2)
    rooms = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    validation_status = models.CharField(max_length=20)

    raw_snapshot = models.JSONField(default=dict, blank=True)

    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["apartment", "-created_at"]),
        ]

    def __str__(self):
        return f"History {self.apartment_id} @ v{self.version.version_number}"


# bezpieczenstwo
class SafetyData(models.Model):
    district = models.ForeignKey(
        District, on_delete=models.CASCADE, related_name="safety_records"
    )
    year = models.PositiveSmallIntegerField()
    population = models.PositiveIntegerField(null=True, blank=True)
    crimes_total = models.PositiveIntegerField(null=True, blank=True)
    crimes_per_1000 = models.DecimalField(max_digits=8, decimal_places=3)
    source = models.CharField(max_length=100, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["district", "year"], name="uniq_safety_per_year"
            ),
        ]
        ordering = ["-year", "district"]

    def __str__(self):
        return f"{self.district.name} {self.year}: {self.crimes_per_1000}/1000"


# edukacja
class EducationFacility(models.Model):
    TYPE_CHOICES = [
        ("kindergarten", "Przedszkole"),
        ("primary", "Podstawowa"),
        ("secondary", "Średnia"),
        ("university", "Uczelnia / college"),
        ("other", "Inne"),
    ]

    name = models.CharField(max_length=300, blank=True)
    facility_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    raw_amenity = models.CharField(max_length=50, blank=True)
    raw_school_tag = models.CharField(max_length=50, blank=True)
    raw_isced = models.CharField(max_length=20, blank=True)

    location = gis_models.PointField(srid=4326, spatial_index=True)
    district = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="education_facilities",
    )

    class Meta:
        indexes = [
            models.Index(fields=["facility_type"]),
        ]

    def __str__(self):
        return f"{self.get_facility_type_display()}: {self.name or '(bez nazwy)'}"

# ulubione
class FavoriteApartment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_apartments",
    )
    apartment = models.ForeignKey(
        Apartment,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "apartment"], name="uniq_user_favorite"
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} <3 {self.apartment_id}"