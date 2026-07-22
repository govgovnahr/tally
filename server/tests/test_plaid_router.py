import routers.plaid_router as plaid_router


def test_oauth_redirect_uri_uses_app_root_when_app_url_set(monkeypatch):
    monkeypatch.setenv("APP_URL", "https://budget-app-vw07.onrender.com")
    assert plaid_router._oauth_redirect_uri() == "https://budget-app-vw07.onrender.com/"


def test_oauth_redirect_uri_none_without_app_url(monkeypatch):
    monkeypatch.delenv("APP_URL", raising=False)
    assert plaid_router._oauth_redirect_uri() is None


class _FakeLinkTokenResponse:
    def __init__(self, link_token):
        self.link_token = link_token


class _FakeClient:
    def __init__(self):
        self.last_request = None

    def link_token_create(self, request):
        self.last_request = request
        return _FakeLinkTokenResponse("fake-link-token")


def test_link_token_includes_redirect_uri_when_app_url_set(client, monkeypatch):
    # OAuth institutions (Chase, BofA, ...) need redirect_uri on the link token
    # itself — Plaid rejects the OAuth handoff without one, even though non-OAuth
    # Sandbox institutions never needed it before.
    monkeypatch.setenv("APP_URL", "https://budget-app-vw07.onrender.com")
    fake_client = _FakeClient()
    monkeypatch.setattr(plaid_router, "get_client", lambda: fake_client)

    r = client.post("/plaid/link-token")

    assert r.status_code == 200
    assert r.json() == {"link_token": "fake-link-token"}
    assert fake_client.last_request.to_dict().get("redirect_uri") == "https://budget-app-vw07.onrender.com/"


def test_link_token_omits_redirect_uri_without_app_url(client, monkeypatch):
    # Local dev / the desktop build have no public URL for Plaid to redirect to —
    # redirect_uri must be left out entirely (Plaid rejects an unregistered one),
    # not sent as an empty string.
    monkeypatch.delenv("APP_URL", raising=False)
    fake_client = _FakeClient()
    monkeypatch.setattr(plaid_router, "get_client", lambda: fake_client)

    r = client.post("/plaid/link-token")

    assert r.status_code == 200
    assert "redirect_uri" not in fake_client.last_request.to_dict()
