from django.contrib import admin
from .models import TravelPlan, UserProfile, VoiceInteraction, ExpenseEntry, UserAPIKey


@admin.register(TravelPlan)
class TravelPlanAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'budget_limit', 'currency', 'created_at', 'is_synced']
    list_filter = ['status', 'currency', 'is_synced', 'created_at']
    search_fields = ['title', 'user__username']
    readonly_fields = ['created_at', 'updated_at', 'sync_version']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'preferred_currency', 'preferred_language', 'last_sync', 'created_at']
    list_filter = ['preferred_currency', 'preferred_language', 'created_at']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(VoiceInteraction)
class VoiceInteractionAdmin(admin.ModelAdmin):
    list_display = ['user', 'intent', 'travel_plan', 'processing_time', 'created_at']
    list_filter = ['intent', 'created_at']
    search_fields = ['user__username', 'transcription', 'response']
    readonly_fields = ['created_at', 'processing_time']


@admin.register(ExpenseEntry)
class ExpenseEntryAdmin(admin.ModelAdmin):
    list_display = ['travel_plan', 'category', 'amount', 'currency', 'description', 'created_at', 'is_synced']
    list_filter = ['category', 'currency', 'is_synced', 'created_at']
    search_fields = ['travel_plan__title', 'description']
    readonly_fields = ['created_at']


@admin.register(UserAPIKey)
class UserAPIKeyAdmin(admin.ModelAdmin):
    list_display = ['user', 'service', 'is_active', 'is_valid', 'last_validated', 'created_at']
    list_filter = ['service', 'is_active', 'is_valid', 'created_at']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at', 'encrypted_key']
    
    def get_readonly_fields(self, request, obj=None):
        # 加密密钥字段只读，防止直接编辑
        return self.readonly_fields