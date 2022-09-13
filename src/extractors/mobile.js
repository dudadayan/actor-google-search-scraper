const { ensureItsAbsoluteUrl } = require('./ensure_absolute_url');
const { extractPeopleAlsoAsk, extractDescriptionAndDate } = require('./extractor_tools');

/**
 * there are 3 possible mobile layouts, we need to find out
 * which one is the current by looking at some unique elements
 * on the page
 *
 * @returns {'weblight' | 'mobile' | 'desktop-like'}
 */
const determineLayout = ($) => {
    if ($('meta[content*="xml"]').length > 0) {
        // this version is the lowest-end possible
        // all links are appended with googleweblight.com
        return 'weblight';
    }

    if ($('meta[name="viewport"]').length > 0 && $('html[itemscope]').length === 0) {
        // this version is intermediate and has a layout
        // made only for mobile.
        return 'mobile';
    }

    // assume a desktop-like layout, with Javascript enabled
    return 'desktop-like';
};

exports.determineLayout = determineLayout;

/**
 * Extracts URL from /url?q=[site here]
 * Sometimes it's nested
 *
 * @param {string} url
 * @param {string} hostname
 */
const getUrlFromParameter = (url, hostname) => {
    if (!url) {
        return '';
    }

    try {
        let parsedUrl = new URL(ensureItsAbsoluteUrl(url, hostname));
        let query = (parsedUrl.searchParams.get('q') || url);

        if (query.includes('googleweblight')) {
            // nested url, must get the url from `lite_url` query param
            // usually from the https:// version of the search
            parsedUrl = new URL(query);
            query = parsedUrl.searchParams.get('lite_url') || query;
        }

        return query;
    } catch (e) {
        return '';
    }
};

exports.extractOrganicResults = ($, hostname) => {
    const searchResults = [];

    const layout = determineLayout($);

    if (layout === 'desktop-like') {
        // Not sure if #ires, .srg > div still works in some cases, left it there for now after I added the third selector (Lukas)
        $('#ires, .srg > div, .Ww4FFb.n3YsHb.xpd.EtOod.pkphOe').each((_index, el) => {
            const siteLinks = [];
            const $el = $(el);

            $el
                .find('[jsname].dJMePd a')
                .each((_i, siteLinkEl) => {
                    siteLinks.push({
                        title: $(siteLinkEl).text(),
                        url: $(siteLinkEl).attr('href'),
                        description: null,
                    });
                });

            const productInfo = {};
            const productInfoRatingText = $(el).find('.MvDXgc').text().trim();

            // Using regexes here because I think it might be more stable than complicated selectors
            if (productInfoRatingText) {
                const ratingMatch = productInfoRatingText.match(/([0-9.]+)\s+\(([0-9,]+)\)/);
                if (ratingMatch) {
                    productInfo.rating = Number(ratingMatch[1]);
                    productInfo.numberOfReviews = Number(ratingMatch[2]);
                }
            }

            const productInfoPriceText = $(el).find('.jC6vSe').contents()[2]?.textContent?.trim();
            if (productInfoPriceText) {
                productInfo.price = Number(productInfoPriceText.replace(/[^0-9.]/g, ''));
            }

            const ping = $(el).find('a').first().attr('ping');
            const params = new Proxy(new URLSearchParams(ping), {
                get: (searchParams, prop) => searchParams.get(prop),
            });
            searchResults.push({
                title: $el.find('a div[role="heading"]').text(),
                url: $el.find('a').first().attr('href'),
                displayedUrl: $el.find('span.qzEoUe').first().text(),
                ...extractDescriptionAndDate($el.find('div.yDYNvb').text()),
                emphasizedKeywords: $el.find('div.yDYNvb').find('em, b').map((_i, element) => $(element).text().trim()).toArray(),
                pingVed: params.ved,
                itemVed: $el.closest('div[data-ved]').attr('data-ved'),
                lang: $el.parents('div[lang]').attr('lang'),
                siteLinks,
                productInfo,
            });
        });
    }

    if (layout === 'mobile') {
        $('#main > div:not([class])')
            .filter((_index, el) => {
                return $(el).find('a[href^="/url"]').length > 0;
            })
            .each((_index, el) => {
                const $el = $(el);

                const siteLinks = [];

                $el
                    .find('.s3v9rd a')
                    .each((_i, siteLinkEl) => {
                        siteLinks.push({
                            title: $(siteLinkEl)
                                .text()
                                .trim(),
                            url: getUrlFromParameter(
                                $(siteLinkEl).attr('href'),
                                hostname,
                            ),
                            description: null,
                        });
                    });

                // product info not added because I don't know how to mock this (Lukas)
                const $description = $el.find('.s3v9rd').first().find('> div > div > div')
                    .clone()
                    .children()
                    .remove()
                    .end();

                const ping = $el.find('a').first().attr('ping');
                const params = new Proxy(new URLSearchParams(ping), {
                    get: (searchParams, prop) => searchParams.get(prop),
                });
                searchResults.push({
                    title: $el.find('a > h3').eq(0).text().trim(),
                    url: getUrlFromParameter($el.find('a').first().attr('href'), hostname),
                    displayedUrl: $el.find('a > div').eq(0).text().trim(),
                    ...extractDescriptionAndDate($description.text().replace(/ · /g, '').trim()),
                    emphasizedKeywords: $description.find('em, b').map((_i, element) => $(element).text().trim()).toArray(),
                    pingVed: params.ved,
                    itemVed: $el.closest('div[data-ved]').attr('data-ved'),
                    lang: $el.parents('div[lang]').attr('lang'),
                    siteLinks,
                });
            });
    }

    if (layout === 'weblight') {
        $('body > div > div > div')
            .filter((_i, el) => {
                return $(el).find('a[href*="googleweblight"],a[href^="/url"]').length > 0;
            })
            .each((_i, el) => {
                const $el = $(el);
                const siteLinks = [];

                $el
                    .find('a.M3vVJe')
                    .each((_index, siteLinkEl) => {
                        siteLinks.push({
                            title: $(siteLinkEl).text(),
                            url: getUrlFromParameter(
                                $(siteLinkEl).attr('href'),
                                hostname,
                            ),
                            description: null,
                        });
                    });

                // product info not added because I don't know how to mock this (Lukas)

                searchResults.push({
                    title: $el
                        .find('a > span')
                        .eq(0)
                        .text()
                        .trim(),
                    url: getUrlFromParameter(
                        $el
                            .find('a')
                            .first()
                            .attr('href'),
                        hostname,
                    ),
                    displayedUrl: $el
                        .find('a > span')
                        .eq(1)
                        .text()
                        .trim(),
                    ...extractDescriptionAndDate($el.find('table span').first().text().trim()),
                    emphasizedKeywords: $el.find('table span').first().find('em, b').map((_index, element) => $(element).text().trim())
                        .toArray(),
                    siteLinks,
                });
            });
    }

    return searchResults;
};

exports.extractPaidResults = ($) => {
    const ads = [];

    const layout = determineLayout($);

    if (layout === 'desktop-like') {
        $('.ads-fr').each((index, el) => {
            const $el = $(el);
            const siteLinks = [];

            $el.find('a')
                .not('[data-rw]')
                .not('[ping]')
                .not('[data-is-ad]')
                .not('.aob-link')
                .each((i, link) => {
                    if ($(link).attr('href')) {
                        siteLinks.push({
                            title: $(link).text(),
                            url: $(link).attr('href'),
                            description: null,
                        });
                    }
                });

            const $heading = $el.find('div[role=heading]');
            const $url = $heading.parent('a');

            ads.push({
                title: $heading.find('span').length ? $heading.find('span').toArray().map((s) => $(s).text()).join(' ') : $heading.text(),
                url: $url.attr('href'),
                displayedUrl: $url.next('div').find('> span').eq(1).text()
                    || $url.find('> div').eq(0).find('> div > span').eq(1)
                        .text(),
                ...extractDescriptionAndDate($url.parent().next('div').find('span').eq(0)
                    .text()),
                emphasizedKeywords: $url.parent().next('div').find('span').eq(0)
                    .find('em, b')
                    .map((_i, element) => $(element).text().trim())
                    .toArray(),
                siteLinks,
            });
        });

        // Different desktop-like layout
        if (ads.length === 0) {
            $('div[id^=tads] div.uEierd').each((_i, el) => {
                const $el = $(el);
                const siteLinks = [];

                // This is for vertical sie links
                $el.find('.BmP5tf .MUxGbd a[data-hveid]').each((_index, e) => {
                    siteLinks.push({
                        title: $(e).text().trim(),
                        url: $(e).attr('href'),
                        description: null,
                    });
                });

                // This is for horizontal site links
                $el.find('g-scrolling-carousel a').each((_index, e) => {
                    siteLinks.push({
                        title: $(e).text().trim(),
                        url: $(e).attr('href'),
                        description: null,
                    });
                });

                ads.push({
                    title: $el.find('div[role="heading"]').text().trim(),
                    url: $el.find('a').attr('href'),
                    displayedUrl: $el.find('a span.Zu0yb.UGIkD.qzEoUe').text().trim(),
                    ...extractDescriptionAndDate($el.find('div.w1C3Le div.MUxGbd.yDYNvb.lEBKkf').text().trim()),
                    emphasizedKeywords: $el.find('div.w1C3Le div.MUxGbd.yDYNvb.lEBKkf').find('em, b')
                        .map((_index, e) => $(e).text().trim()).toArray(),
                    siteLinks,
                });
            });
        }
    }

    if (layout === 'mobile') {
        $('#main > div').filter((_i, el) => $(el).find('div[role=heading]').length > 0)
            .each((i, el) => {
                const $el = $(el);

                const siteLinks = [];
                $(el).find('> div > div > div > a').each((_j, link) => {
                    siteLinks.push({
                        title: $(link).text(),
                        url: $(link).attr('href'),
                        description: null,
                    });
                });

                const $heading = $el.find('[role="heading"]');

                ads.push({
                    title: $heading.text(),
                    url: $el.find('a[href*="aclk"]').attr('href'),
                    displayedUrl: $heading.next('div').find('> span > span').text(),
                    ...extractDescriptionAndDate($el.find('> div > div > div > span').text()),
                    emphasizedKeywords: $el.find('> div > div > div > span').find('em, b')
                        .map((_i, element) => $(element).text().trim()).toArray(),
                    siteLinks,
                });
            });
    }

    return ads;
};

exports.extractPaidProducts = ($) => {
    const products = [];

    $('.itG22d .pla-unit-container').each((_i, el) => {
        const headingEl = $(el).find('[role="heading"]');
        const siblingEls = headingEl.nextAll();
        const displayedUrlEl = siblingEls.last();
        const prices = [];

        siblingEls.each((_index, siblingEl) => {
            if (siblingEl !== displayedUrlEl[0]) prices.push($(siblingEl).text());
        });

        products.push({
            title: headingEl.text(),
            url: $(el).find('a').attr('href'),
            displayedUrl: $(el).find('.a').text(),
            prices,
        });
    });

    return products;
};

exports.extractTotalResults = () => {
    return 'N/A';
};

exports.extractRelatedQueries = ($, hostname) => {
    const related = [];

    const layout = determineLayout($);

    function processSelector(selector) {
        $(selector).each((_index, el) => {
            related.push({
                title: $(el).text().trim(),
                url: ensureItsAbsoluteUrl($(el).attr('href'), hostname),
            });
        });
    }

    if (layout === 'desktop-like') {
        // some previous selectors, unsure if they still match something on some pages
        processSelector('#extrares h2 ~ a');
        processSelector('#bres span a');
        processSelector('#brs p a');
        // carousel of boxes with images on first page of search
        processSelector('.mR2gOd.Y3nRse .luHZgb .nZWEZc a');
        // seems to match all lines [magnifying glass] <related query>, no matter if they're located under the top banner, or in the middle of a page
        processSelector('a.iOJVmb');
    }

    if (layout === 'mobile') {
        $('a[href^="/search"].tHmfQe').each((_index, el) => {
            related.push({
                title: $(el).text().trim(),
                url: ensureItsAbsoluteUrl($(el).attr('href'), hostname),
            });
        });
    }

    if (layout === 'weblight') {
        $('a[href^="/search"].ZWRArf').each((_index, el) => {
            related.push({
                title: $(el).text().trim(),
                url: ensureItsAbsoluteUrl($(el).attr('href'), hostname),
            });
        });
    }

    return related;
};

exports.extractPeopleAlsoAsk = ($) => {
    return extractPeopleAlsoAsk($);
};
