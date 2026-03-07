from django.urls import path
from .views import health, get_safety_data, get_apartments_data

urlpatterns =[
    path("health/", health, name="health"),
    path("safety/", get_safety_data, name="safety_data"),
    path("apartments/", get_apartments_data, name="apartments_data"),
]