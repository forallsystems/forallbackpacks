from django import forms
from django.forms import widgets
from django.contrib import admin
from .models import *

class TokenWidget(widgets.TextInput):
    """
    Custom form widget for tokens
    Requires forallbackpack/js/admin.js
    """
    def render(self, name, value, attrs=None):
        attrs['style'] = "width:400px"        
        action = 'setTokenValue(\''+attrs['id']+'\', 50)'
        
        html = super(TokenWidget, self).render(name, value, attrs)\
            + '<input type="button" value="Generate" style="margin-left: 6px;" onclick="'+action+'">'
        return html

class RegistrationForm(forms.ModelForm):
    class Meta:
        widgets = {
            'secret': TokenWidget(),
            'key': TokenWidget()
        }
    
    class Media:
         js = ('forallbackpack/js/admin.js',)


@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ('name', 'prefix', 'url', 'has_forall_permissions')
    list_display_links = ('name', 'prefix',)
    form = RegistrationForm

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_email', 'phone_number', 'user_first_name', 'user_last_name')
    search_fields = ('id', 'user__email', 'user__first_name', 'user__last_name')

    def user_email(self, instance):
        return instance.user.email

    def user_first_name(self, instance):
        return instance.user.first_name
    
    def user_last_name(self, instance):
        return instance.user.last_name

@admin.register(UserEmail)
class UserEmailAdmin(admin.ModelAdmin):
    list_display = ('email', 'user_first_name', 'user_last_name', 'is_primary', 'is_validated')
    list_display_links = ('email',  'user_first_name', 'user_last_name')
    list_filter = ('is_primary', 'is_validated',)
    search_fields = ('email', 'user__first_name', 'user__last_name',)

    def user_first_name(self, instance):
        return instance.user.first_name
    
    def user_last_name(self, instance):
        return instance.user.last_name
    
@admin.register(UserAccount)
class UserAccountAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'user_first_name', 'user_last_name', 'registration',)
    list_display_links = ('user_email', 'user_first_name', 'user_last_name', 'registration',)
    list_filter = ('registration',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name',)
    
    def user_email(self, instance):
        return instance.user.email

    def user_first_name(self, instance):
        return instance.user.first_name
    
    def user_last_name(self, instance):
        return instance.user.last_name
    
@admin.register(UserApp)
class UserAppAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'user_first_name', 'user_last_name', 'app_name', 'app_url',)
    list_display_links = ('user_email', 'user_first_name', 'user_last_name', 'app_name', 'app_url',)
    list_filter = ('app_name',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name',)
    
    def user_email(self, instance):
        return instance.user.email

    def user_first_name(self, instance):
        return instance.user.first_name
    
    def user_last_name(self, instance):
        return instance.user.last_name

@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'type',)
    list_display_links = ('user', 'type',)
 
@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('registration_name', 'name', 'role', 'is_pledge',)
    list_display_links = ('registration_name', 'name', 'role', 'is_pledge',)

    def registration_name(self, instance):
        return instance.registration.name

class AwardEndorsementInline(admin.StackedInline):
    model = AwardEndorsement
    extra = 0
    
@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ('user', 'student_email', 'badge_name', 'org_issued_name', 'is_active',)
    list_display_links = ('user', 'badge_name', 'org_issued_name',)
    list_filter = ('is_deleted',)
    inlines = [AwardEndorsementInline,]
    
    def is_active(self, instance):
        return not instance.is_deleted
    is_active.boolean = True

@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ('award_name', 'label',)
    
    def award_name(self, instance):
        return instance.award.badge_name
    
class SectionInline(admin.StackedInline):
    model = Section
    extra = 0
    fields = ('title', 'text', 'is_deleted', 'attachments')
    readonly_fields = ('attachments',)
    
    def attachments(self, obj):
        return ';'.join([str(r) for r in obj.attachments.all()])
    
@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'award', 'section_title', 'created_dt', 'is_deleted',)
    list_display_links = ('user', 'section_title', 'created_dt', )
    list_filter = ('is_deleted',)
    inlines = [
        SectionInline,
    ]  
      
    def section_title(self, instance):
        return instance.sections.first().title
   
@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_dt', 'content_type', 'object_id', 'type', 'is_active',)
    list_display_links = ('user', 'created_dt', 'content_type', 'object_id', 'type',)
    
    def is_active(self, instance):
        return not instance.is_deleted
    is_active.boolean = True
    
 