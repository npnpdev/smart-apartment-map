# smart-apartment-map
See develop branch for active development

Aby załadować dane
```
docker compose exec backend python manage.py import_scraped_apartments
```

Aby cofnąć 
```
docker compose exec backend python manage.py rollback_import 2
```