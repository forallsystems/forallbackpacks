from django import template

def url_target_blank(text):
    return text.replace('<a ', '<a target="_blank" ')

register = template.Library()
url_target_blank = register.filter(url_target_blank, is_safe = True)
