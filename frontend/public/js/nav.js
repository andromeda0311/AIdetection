// admin sidebar — URL hash navigation (active link + expanded branches).
(function () {
  var SIDEBAR_HASH_LINK_KEY = "hsl";
  var SIDEBAR_HASH_OPEN_KEY = "hso";

  function normalizePath(pathname) {
    if (!pathname) {
      return "/";
    }

    var normalized = pathname.toLowerCase();
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }

    return normalized || "/";
  }

  function getBestMatchingLink(links, currentPath) {
    var bestLink = null;
    var bestScore = -1;

    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href === "#" || href.startsWith("javascript:")) {
        return;
      }

      var linkPath = normalizePath(new URL(href, window.location.origin).pathname);
      var isExact = linkPath === currentPath;
      var isParent = linkPath !== "/" && currentPath.startsWith(linkPath + "/");

      if (!isExact && !isParent) {
        return;
      }

      var score = linkPath.length + (isExact ? 10000 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestLink = link;
      }
    });

    return bestLink;
  }

  function getDataNavId(element) {
    if (!element) {
      return null;
    }

    var navId = element.getAttribute("data-nav-id");
    return navId && navId.trim() ? navId.trim() : null;
  }

  function getSidebarNavIds(sidebar) {
    var seen = {};
    var ids = [];

    sidebar.querySelectorAll("[data-nav-id]").forEach(function (item) {
      var id = getDataNavId(item);
      if (!id || seen[id]) {
        return;
      }

      seen[id] = true;
      ids.push(id);
    });

    return ids;
  }

  function encodeNavId(navId, sidebar) {
    if (!navId) {
      return null;
    }

    var ids = getSidebarNavIds(sidebar);
    var index = ids.indexOf(navId);
    if (index < 0) {
      return navId;
    }

    return index.toString(36);
  }

  function decodeNavId(token, sidebar) {
    if (!token) {
      return null;
    }

    // Keep legacy full ids usable (for existing URLs).
    if (token.indexOf("-") >= 0) {
      return token;
    }

    var index = Number.parseInt(token, 36);
    if (!Number.isFinite(index) || index < 0) {
      return token;
    }

    var ids = getSidebarNavIds(sidebar);
    if (index >= ids.length) {
      return token;
    }

    return ids[index];
  }

  function decodeNavIds(tokens, sidebar) {
    if (!Array.isArray(tokens)) {
      return [];
    }

    return tokens
      .map(function (token) {
        return decodeNavId(token, sidebar);
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function encodeNavIds(ids, sidebar) {
    if (!Array.isArray(ids)) {
      return [];
    }

    return ids
      .map(function (id) {
        return encodeNavId(id, sidebar);
      })
      .filter(function (token) {
        return !!token;
      });
  }

  function getParentBranchIds(item, sidebar) {
    var ids = [];
    var current = item.closest("li.slide");

    while (current && sidebar.contains(current)) {
      if (current.classList.contains("has-sub")) {
        var branchId = getDataNavId(current);
        if (branchId) {
          ids.push(branchId);
        }
      }

      var parentMenu = current.closest("ul.slide-menu");
      current = parentMenu ? parentMenu.closest("li.slide.has-sub") : null;
    }

    return ids;
  }

  function getOpenBranchIds(sidebar) {
    return Array.from(sidebar.querySelectorAll("li.slide.has-sub.open"))
      .map(function (branch) {
        return getDataNavId(branch);
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function readHashState() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (window.location.hash && window.location.hash.length > 1) {
        var hashParams = new URLSearchParams(
          window.location.hash.charAt(0) === "#" ? window.location.hash.slice(1) : window.location.hash
        );
        hashParams.forEach(function (value, key) {
          params.set(key, value);
        });
      }

      var activeLinkId = params.get(SIDEBAR_HASH_LINK_KEY);
      var openRaw = params.get(SIDEBAR_HASH_OPEN_KEY);

      if (!activeLinkId && !openRaw) {
        return null;
      }

      var openBranchIds = (openRaw || "")
        .split(",")
        .map(function (id) {
          return id.trim();
        })
        .filter(function (id) {
          return !!id;
        });

      return {
        activeLinkId: activeLinkId || null,
        openBranchIds: openBranchIds
      };
    } catch (error) {
      return null;
    }
  }

  function writeHashState(state, sidebar) {
    try {
      var params = new URLSearchParams(window.location.hash.charAt(0) === "#" ? window.location.hash.slice(1) : window.location.hash);
      var encodedActiveLink = state ? encodeNavId(state.activeLinkId, sidebar) : null;
      var encodedOpenBranches = state ? encodeNavIds(state.openBranchIds || [], sidebar) : [];

      if (encodedActiveLink) {
        params.set(SIDEBAR_HASH_LINK_KEY, encodedActiveLink);
      } else {
        params.delete(SIDEBAR_HASH_LINK_KEY);
      }

      if (encodedOpenBranches.length > 0) {
        params.set(SIDEBAR_HASH_OPEN_KEY, encodedOpenBranches.join(","));
      } else {
        params.delete(SIDEBAR_HASH_OPEN_KEY);
      }

      var hash = params.toString();
      var targetUrl = window.location.pathname + window.location.search + (hash ? "#" + hash : "");
      window.history.replaceState(null, document.title, targetUrl);
    } catch (error) {
      // Ignore hash update errors.
    }
  }

  function buildHrefWithHash(href, state, sidebar) {
    var url = new URL(href, window.location.origin);
    var params = new URLSearchParams(url.hash && url.hash.charAt(0) === "#" ? url.hash.slice(1) : url.hash);
    var encodedActiveLink = encodeNavId(state.activeLinkId, sidebar);
    var encodedOpenBranches = encodeNavIds(state.openBranchIds, sidebar);

    if (encodedActiveLink) {
      params.set(SIDEBAR_HASH_LINK_KEY, encodedActiveLink);
    } else {
      params.delete(SIDEBAR_HASH_LINK_KEY);
    }

    if (encodedOpenBranches.length > 0) {
      params.set(SIDEBAR_HASH_OPEN_KEY, encodedOpenBranches.join(","));
    } else {
      params.delete(SIDEBAR_HASH_OPEN_KEY);
    }

    var hash = params.toString();
    url.hash = hash ? "#" + hash : "";
    return url.toString();
  }

  function findLinkByNavId(links, navId) {
    if (!navId) {
      return null;
    }

    for (var i = 0; i < links.length; i += 1) {
      if (links[i].getAttribute("data-nav-id") === navId) {
        return links[i];
      }
    }

    return null;
  }

  function applyStoredOpenBranches(sidebar, branchIds) {
    if (!Array.isArray(branchIds) || branchIds.length === 0) {
      return;
    }

    sidebar.querySelectorAll("li.slide.has-sub").forEach(function (branch) {
      var branchId = getDataNavId(branch);
      if (!branchId || branchIds.indexOf(branchId) < 0) {
        return;
      }

      setBranchExpanded(branch, true);
    });
  }

  function clearSidebarState(sidebar) {
    sidebar.querySelectorAll("a.side-menu__item.active").forEach(function (item) {
      item.classList.remove("active");
    });

    sidebar.querySelectorAll("li.slide.active").forEach(function (item) {
      item.classList.remove("active");
    });

    sidebar.querySelectorAll("li.slide.has-sub.open").forEach(function (item) {
      item.classList.remove("open");
    });

    sidebar.querySelectorAll("li.slide.has-sub > ul.slide-menu").forEach(function (submenu) {
      submenu.style.display = "";
    });
  }

  function setBranchExpanded(branch, isExpanded) {
    if (!branch) {
      return;
    }

    if (isExpanded) {
      branch.classList.add("open");
    } else {
      branch.classList.remove("open");
    }

    var toggle = branch.querySelector(":scope > a.side-menu__item");
    if (toggle) {
      if (!isExpanded) {
        toggle.classList.remove("active");
      }
    }

    var submenu = branch.querySelector(":scope > ul.slide-menu");
    if (submenu) {
      submenu.style.display = isExpanded ? "block" : "";
    }
  }

  function openParentBranches(activeLink, sidebar) {
    activeLink.classList.add("active");
    var activeRow = activeLink.closest("li.slide");
    if (activeRow) {
      activeRow.classList.add("active");
    }

    var current = activeLink.closest("li.slide");
    while (current && sidebar.contains(current)) {
      if (current.classList.contains("has-sub")) {
        setBranchExpanded(current, true);
      }

      var parentMenu = current.closest("ul.slide-menu");
      current = parentMenu ? parentMenu.closest("li.slide.has-sub") : null;
    }
  }

  function applySidebarActiveState() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      return;
    }

    var links = Array.from(sidebar.querySelectorAll('a.side-menu__item[data-nav-link="true"]'));
    if (!links.length) {
      return;
    }

    var hashState = readHashState();
    var activeLink = hashState ? findLinkByNavId(links, decodeNavId(hashState.activeLinkId, sidebar)) : null;

    if (!activeLink) {
      activeLink = getBestMatchingLink(links, normalizePath(window.location.pathname));
    }

    clearSidebarState(sidebar);
    if (activeLink) {
      openParentBranches(activeLink, sidebar);
      applyStoredOpenBranches(sidebar, hashState ? decodeNavIds(hashState.openBranchIds, sidebar) : []);
      writeHashState({
        activeLinkId: activeLink.getAttribute("data-nav-id"),
        openBranchIds: getParentBranchIds(activeLink, sidebar)
      }, sidebar);
      return;
    }

    if (hashState) {
      applyStoredOpenBranches(sidebar, decodeNavIds(hashState.openBranchIds, sidebar));
      writeHashState({
        activeLinkId: decodeNavId(hashState.activeLinkId, sidebar) || null,
        openBranchIds: getOpenBranchIds(sidebar)
      }, sidebar);
    }
  }

  function applyTopModuleActiveState() {
    var moduleNav = document.getElementById("navbarNavModules");
    if (!moduleNav) {
      return;
    }

    var links = Array.from(moduleNav.querySelectorAll('a.nav-link[data-module-link="true"]'));
    if (!links.length) {
      return;
    }

    links.forEach(function (link) {
      link.classList.remove("active");
    });

    var activeLink = getBestMatchingLink(links, normalizePath(window.location.pathname));
    if (!activeLink) {
      // Default to the first configured module when no URL match exists.
      activeLink = links[0];
    }
    if (activeLink) {
      activeLink.classList.add("active");
    }
  }

  function toggleSidebarBranch(anchor, sidebar) {
    var branch = anchor.closest("li.slide.has-sub");
    if (!branch || branch.querySelector(":scope > a.side-menu__item") !== anchor) {
      return false;
    }

    var parentList = branch.parentElement;
    if (parentList) {
      parentList.querySelectorAll(":scope > li.slide.has-sub.open").forEach(function (sibling) {
        if (sibling !== branch) {
          setBranchExpanded(sibling, false);
        }
      });
    }

    setBranchExpanded(branch, !branch.classList.contains("open"));
    return true;
  }

  function persistSidebarOpenState(sidebar) {
    window.setTimeout(function () {
      var existing = readHashState() || {};
      writeHashState({
        activeLinkId: decodeNavId(existing.activeLinkId, sidebar) || null,
        openBranchIds: getOpenBranchIds(sidebar)
      }, sidebar);
    }, 30);
  }

  function attachSelectionPersistence() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      return;
    }

    sidebar.addEventListener("click", function (event) {
      var anchor = event.target.closest("a.side-menu__item");
      if (!anchor || !sidebar.contains(anchor)) {
        return;
      }

      var isLink = anchor.getAttribute("data-nav-link") === "true";
      if (isLink) {
        var href = anchor.getAttribute("href");
        if (!href || href === "#" || href.startsWith("javascript:")) {
          return;
        }

        var updatedHref = buildHrefWithHash(href, {
          activeLinkId: anchor.getAttribute("data-nav-id"),
          openBranchIds: getParentBranchIds(anchor, sidebar)
        }, sidebar);

        // Keep relative paths so Next.js client navigation still works.
        try {
          var parsed = new URL(updatedHref, window.location.origin);
          anchor.setAttribute("href", parsed.pathname + parsed.search + parsed.hash);
        } catch (error) {
          anchor.setAttribute("href", updatedHref);
        }
        return;
      }

      if (toggleSidebarBranch(anchor, sidebar)) {
        event.preventDefault();
        persistSidebarOpenState(sidebar);
        return;
      }

      persistSidebarOpenState(sidebar);
    });
  }

  function observeSidebarMenu() {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      return;
    }

    var menu = sidebar.querySelector(".main-menu");
    if (!menu) {
      return;
    }

    var refreshTimer = null;
    var observer = new MutationObserver(function () {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(function () {
        refreshTimer = null;
        applySidebarActiveState();
      }, 0);
    });

    observer.observe(menu, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    attachSelectionPersistence();
    observeSidebarMenu();
    applySidebarActiveState();
    applyTopModuleActiveState();
    window.setTimeout(applySidebarActiveState, 120);
    window.setTimeout(applyTopModuleActiveState, 120);
    window.setTimeout(applySidebarActiveState, 420);
    window.setTimeout(applyTopModuleActiveState, 420);
  });
})();
