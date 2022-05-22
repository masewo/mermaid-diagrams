(function () {
	const $ = (selector, ctx = document) => [].slice.call(ctx.querySelectorAll(selector));

	let transformations = [];

	if (/github\.com/i.test(window.location.href)) {
		transformations.push(...[
			{
				parentElementSelector: '[lang="mermaid"]',
				childElementSelector: 'code',
				diagramRegex: /(.+)/s,
				functionToCall: transformRender,
			}
		]);
	}

	if (/github\.com.*(_new|_edit)$/i.test(window.location.href)) {
		transformations.push(...[
			{
				parentElementSelector: 'main',
				childElementSelector: '.repository-content',
				functionToCall: transformNewPage,
			}
		]);
	}

	if (/dev\.azure\.com/i.test(window.location.href)) {
		transformations.push(...[
			{
				parentElementSelector: 'div.markdown-content > pre.hljs',
				childElementSelector: 'code',
				diagramRegex: /^\s*((classDiagram|classDiagram-v2|erDiagram|flowchart|gitGraph|journey|gannt|graph|pie|requirementDiagram|sequenceDiagram|stateDiagram|stateDiagram-v2) ?.*)$/s,
				functionToCall: transformRender,
			}
		]);
	}

	function renderChart(parentElem, code) {

		var source_name = parentElem.id;

		if (parentElem.id == "") {
			const postfix = Math.random().toString(36).substr(2, 9);
			source_name = 'idname_' + postfix;
			parentElem.id = source_name;
		}

		var mermaid_name = 'mermaid__' + source_name;
		let existingDiagram;
		let existingDiagrams = $(`#${mermaid_name}`);
		if (existingDiagrams.length > 0) {
			existingDiagram = existingDiagrams[0];
		}
		else {
			// Create the element that will house the rendered diagram.
			parentElem.insertAdjacentHTML('afterend', `<div id="${mermaid_name}"></div>`);
			existingDiagram = $(`#${mermaid_name}`)[0];

			// Create an observer to track changes to the diagram code.
			const observer = new MutationObserver(() => {
				processElement(parentElem);
			});
			observer.observe(parentElem, { characterData: true, childList: true, subtree: true });
		}

		try {
			const insertSvg = function (svg) {
				existingDiagram.innerHTML = svg;
			}

			code = addDarkModeIfNeeded(code)

			// Generate or regenerate diagram if it is existing.
			window.mermaid.render(`${mermaid_name}_svg`, code, insertSvg);
		}
		catch (error) {
			console.error('>>> mermaid error', error);
			console.error('Code', code);
		}
	}

	function addDarkModeIfNeeded(code) {
		let useDark = false;
		const dataColorMode = window.document.documentElement.attributes['data-color-mode'].value

		if (dataColorMode.includes('dark')) {
			useDark = true
		} else if (dataColorMode === 'auto') {
			// is system set to dark theme?
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				const dataDarkTheme = window.document.documentElement.attributes['data-dark-theme'].value
				if (dataDarkTheme.includes('dark')) {
					useDark = true
				}
			} else {
				const dataLightTheme = window.document.documentElement.attributes['data-light-theme'].value
				if (dataLightTheme.includes('dark')) {
					useDark = true
				}
			}
		}

		const theme = useDark ? '%%{init: { \'theme\':\'dark\', \'sequence\': {\'useMaxWidth\':false} } }%%\n' : '';
		return theme + code
	}

	function transformElement(parentElement, transformation) {
		const childElements = $(transformation.childElementSelector, parentElement);
		for (const childElement of childElements) {
			transformation.functionToCall(transformation, parentElement, childElement)
		}
	}

	function transformRender(transformation, parentElement, childElement) {
		const diagramRegexMatch = transformation.diagramRegex.exec(childElement.innerText);
		if (diagramRegexMatch === null) {
			return;
		}

		code = diagramRegexMatch[1];
		renderChart(parentElement, code);
	}

	function transformNewPage(transformation, parentElement, childElement) {
        let url = document.location.href;
        url = url.substring(0, url.indexOf('/wiki/') + 5)

		fetch(url).then(r => r.text()).then(result => {
			const parser = new DOMParser();
			const doc = parser.parseFromString(result, "text/html");
			let sidebar = $('.wiki-rightbar > .gollum-markdown-content', doc)[0]
			let html = `<div class="sidebar" style="float:left; margin:10px">${sidebar.innerHTML}</div>`

			childElement.insertAdjacentHTML('afterbegin', html);

			sidebar = $('.repository-content > .sidebar')[0]

			for (const el of $('a', sidebar)) {
				el.addEventListener("click", function (event) {
						event.preventDefault();
                        let href = el.href.substring(el.href.lastIndexOf('/') +1)
                        href = decodeURIComponent(href);
                        href = href.replaceAll('-', ' ')

                        // this is not a colon!
						$('input[name="wiki[name]"]')[0].value = href + '꞉ '
					},
					false);
			}
		})
	}

	function processElement(parentElement) {
		for (const transformation of transformations) {
			const matchingElements = $(transformation.parentElementSelector);
			if (matchingElements.includes(parentElement)) {
				transformElement(parentElement, transformation);

				// remove source code of mermaid diagram
				matchingElements[0].remove();

				break;
			}
		}
	}

	function processPage() {
		for (const transformation of transformations) {
			$(transformation.parentElementSelector).forEach(x => transformElement(x, transformation));
		}
	}

	function onElementInsert(event) {
		// We are only interested in the diagrams that trigger the css animation
		// called "mermaidDiagramCodeInserted". This is determined by the file
		// "on_change_animations.css".
		if (event.animationName !== "mermaidDiagramCodeInserted") {
			return;
		}
		processElement(event.target)
	}

	document.addEventListener('DOMContentLoaded', () => {
		processPage();

		// This catches diagrams that are added to the page after it is loaded.
		// This might include comments from other users.
		document.addEventListener("animationstart", onElementInsert, false);
	});

}());
