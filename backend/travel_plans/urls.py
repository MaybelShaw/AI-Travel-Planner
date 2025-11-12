from rest_framework.routers import DefaultRouter
from .views import (
    TravelPlanViewSet, 
    ExpenseEntryViewSet, 
    BudgetManagementViewSet, 
    UserAPIKeyViewSet,
    LLMAPIKeyViewSet,
    VoiceAPIKeyViewSet,
    VoiceRecognitionViewSet,
    MapServiceViewSet
)

router = DefaultRouter()
router.register(r'travelplans', TravelPlanViewSet, basename='travelplan')
router.register(r'expenses', ExpenseEntryViewSet, basename='expense')
router.register(r'budget', BudgetManagementViewSet, basename='budget')
router.register(r'api-keys', UserAPIKeyViewSet, basename='apikey')
router.register(r'llm-api-keys', LLMAPIKeyViewSet, basename='llmapikey')
router.register(r'voice-api-keys', VoiceAPIKeyViewSet, basename='voiceapikey')
router.register(r'voice', VoiceRecognitionViewSet, basename='voice')
router.register(r'map', MapServiceViewSet, basename='map')

urlpatterns = router.urls
