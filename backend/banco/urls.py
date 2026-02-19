from rest_framework.routers import DefaultRouter

from .views import (
    SubjectViewSet,
    TopicViewSet,
    DescriptorViewSet,
    SkillViewSet,
    QuestionViewSet,
)

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"topics", TopicViewSet, basename="topic")
router.register(r"descriptors", DescriptorViewSet, basename="descriptor")
router.register(r"skills", SkillViewSet, basename="skill")
router.register(r"questions", QuestionViewSet, basename="question")

urlpatterns = router.urls
