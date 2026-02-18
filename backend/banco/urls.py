from rest_framework.routers import DefaultRouter
from .views import DisciplinaViewSet, SaberViewSet, HabilidadeViewSet, QuestaoViewSet

router = DefaultRouter()
router.register(r"disciplinas", DisciplinaViewSet, basename="disciplina")
router.register(r"saberes", SaberViewSet, basename="saber")
router.register(r"habilidades", HabilidadeViewSet, basename="habilidade")
router.register(r"questoes", QuestaoViewSet, basename="questao")

urlpatterns = router.urls
