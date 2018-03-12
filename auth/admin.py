from django.contrib import admin
from .models import *


class UserLoginStatusListFilter(admin.SimpleListFilter):
    title = 'status'

    # Parameter for the filter that will be used in the URL query.
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return (
            ('1', 'Success'),
            ('0', 'Failure'),
        )

    def queryset(self, request, queryset):
        if self.value() == '1':
            return queryset.filter(user__isnull=False)
            
        if self.value() == '0':
            return queryset.filter(user__isnull=True)
                                    
@admin.register(UserLogin)
class UserLogin(admin.ModelAdmin):
    list_display = ('dt', 'remote_addr', 'user',)
    list_filter = (UserLoginStatusListFilter,)
    search_fields = ['user__username']
    readonly_fields = ('dt', 'remote_addr', 'user', 'credentials',)
