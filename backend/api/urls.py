from django.urls import path, include
from . import views
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
#router.register(r"favorites", views.FavoriteViewSet, basename="favorite")


urlpatterns = [
    path("health/", views.health, name="health"),
    path("apartments/", views.ApartmentListView.as_view(), name="apartments"),
    path("education/", views.EducationListView.as_view(), name="education"),
    path("safety/", views.SafetyListView.as_view(), name="safety"),
    path("districts/", views.DistrictGeoView.as_view(), name="districts"),
    path("noise/", views.get_noise_data, name="noise"),
    #path("", include(router.urls)),

]
