from django.urls import path
from .views import health, get_safety_data, get_apartments_data, get_education_data, get_noise_data

urlpatterns = [
    path("health/", health, name="health"),
    path("safety/", get_safety_data, name="safety_data"),
    path("apartments/", get_apartments_data, name="apartments_data"),
    path("education/", get_education_data, name="education_data"),
    path("noise/", get_noise_data, name="noise_data"), 
]
