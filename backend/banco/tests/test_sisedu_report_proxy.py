from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase


class _FakeHttpResponse:
    def __init__(self, payload: str, status_code: int = 200):
        self._payload = payload.encode("utf-8")
        self.status = status_code

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


@override_settings(SISEDU_REPORT_BASE_URL="https://sisedu.exemplo.local")
class SiseduReportProxyTests(APITestCase):
    @patch("banco.views.urllib_request.urlopen")
    def test_disciplinas_proxy_forwards_cookie(self, mock_urlopen):
        mock_urlopen.return_value = _FakeHttpResponse('[{"id": 1, "nome": "Matemática"}]')
        self.client.cookies["sessionid"] = "abc123"

        response = self.client.get(reverse("sisedu-report-disciplinas"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["nome"], "Matemática")
        request_obj = mock_urlopen.call_args[0][0]
        self.assertEqual(request_obj.full_url, "https://sisedu.exemplo.local/api/report/disciplinas/")
        self.assertEqual(request_obj.headers.get("Cookie"), "sessionid=abc123")

    def test_descritores_requires_disciplina(self):
        response = self.client.get(reverse("sisedu-report-descritores"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    @patch("banco.views.urllib_request.urlopen")
    def test_niveis_proxy_appends_query_string_without_serie_nivel(self, mock_urlopen):
        mock_urlopen.return_value = _FakeHttpResponse('[{"id": 2, "nome": "Intermediário"}]')

        response = self.client.get(
            reverse("sisedu-report-niveis-desempenho"),
            {"disciplina": "10"},
        )

        self.assertEqual(response.status_code, 200)
        request_obj = mock_urlopen.call_args[0][0]
        self.assertEqual(
            request_obj.full_url,
            "https://sisedu.exemplo.local/api/report/niveis_desempenho/?disciplina=10",
        )
