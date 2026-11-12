from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Configurable pagination allowing callers to specify `page_size`.

    Preserves the default 20 items per page when omitted, but permits clients
    (such as dashboard widgets that only display 5 recent rows) to request
    fewer records, reducing database load and network transfer.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

