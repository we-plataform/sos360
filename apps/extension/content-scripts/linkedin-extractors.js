/**
 * LinkedIn Extractors - Lia 360
 * Data extraction logic for LinkedIn profiles and cards.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading Extractors module...');

    // Dependency check
    const Utils = window.LiaUtils;
    const Selectors = window.LiaSelectors;

    if (!Utils) {
        console.error('[Lia 360] LiaUtils not found. Check load order.');
        return;
    }

    if (!Selectors) {
        console.error('[Lia 360] LiaSelectors not found. Check load order.');
        return;
    }

    window.LiaExtractors = {
        /**
         * Get quick follower stats from the page
         */
        getQuickStats: function () {
            let followerText = 'N/A';

            try {
                const selector = '.text-body-small, .t-bold, .text-body-small span';
                const elements = document.querySelectorAll(selector);

                for (const el of elements) {
                    const text = el.innerText || el.textContent;
                    if (!text || text.length > 40) continue;

                    const lower = text.toLowerCase();
                    if (lower.includes('follower') || lower.includes('seguidor')) {
                        const match = text.match(/([\d,.]+)\s*(?:followers|seguidores|seguindo)/i);
                        if (match) {
                            followerText = match[1];

                            if (el.closest('.scaffold-layout__main') || el.closest('main') || el.closest('.pv-top-card')) {
                                return { followers: followerText };
                            }
                        }
                    }
                }

                if (followerText !== 'N/A') return { followers: followerText };

            } catch (e) {
                console.error('[Lia 360] getQuickStats error:', e);
            }

            return { followers: followerText };
        },

        /**
         * Extract leads from search results page
         */
        extractSearchResults: function () {
            const leads = [];
            const cards = document.querySelectorAll('.entity-result__item, .search-result__wrapper');
            cards.forEach(card => {
                try {
                    const linkEl = card.querySelector('a[href*="/in/"]');
                    if (!linkEl) return;
                    const profileUrl = linkEl.href?.split('?')[0];
                    const username = Utils.parseLinkedInUrl(profileUrl);

                    leads.push({
                        username,
                        fullName: Utils.getTextContent(card.querySelector('span[aria-hidden="true"]')) || Utils.getTextContent(linkEl) || Utils.formatUsernameAsName(username),
                        profileUrl,
                        bio: Utils.getTextContent(card.querySelector('.entity-result__primary-subtitle, .search-result__subtitle')),
                        avatarUrl: card.querySelector('img')?.src || null,
                    });
                } catch (e) { }
            });
            return leads;
        },

        /**
         * Extract contact info from profile (opens modal)
         */
        extractContactInfo: async function () {
            console.log('[Lia 360] Extracting contact info...');
            const contactLink = document.querySelector('a[href*="/overlay/contact-info"]');
            if (contactLink) {
                contactLink.click();
                await Utils.sleep(1500);
            } else {
                return { email: null, phone: null, website: null, twitter: null, birthday: null };
            }

            const contactInfo = { email: null, phone: null, website: null, twitter: null, birthday: null };
            const modal = document.querySelector('#artdeco-modal-outlet') || document.body;

            const sections = modal.querySelectorAll('.pv-contact-info__contact-type');
            sections.forEach(section => {
                const header = Utils.getTextContent(section.querySelector('.pv-contact-info__header'));
                const content = Utils.getTextContent(section.querySelector('.pv-contact-info__ci-container, a'));

                if (!header || !content) return;
                const h = header.toLowerCase();

                if (h.includes('email')) contactInfo.email = content;
                else if (h.includes('phone') || h.includes('telefone') || h.includes('celular')) contactInfo.phone = content;
                else if (h.includes('site') || h.includes('website')) {
                    contactInfo.website = section.querySelector('a')?.href || content;
                }
                else if (h.includes('twitter')) contactInfo.twitter = content;
                else if (h.includes('birthday') || h.includes('aniversário')) contactInfo.birthday = content;
            });

            if (!contactInfo.email) {
                const link = modal.querySelector('a[href^="mailto:"]');
                if (link) contactInfo.email = link.href.replace('mailto:', '').trim();
            }

            const closeBtn = document.querySelector('[data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Fechar"]');
            if (closeBtn) closeBtn.click();
            await Utils.sleep(500);

            return contactInfo;
        },

        /**
         * Extract skills from profile
         */
        extractSkills: async function () {
            const skills = [];
            const skillSection = document.querySelector('#skills') || document.querySelector('[data-section="skills"]') || document.querySelector('section.skills');
            if (skillSection) {
                const container = skillSection.closest('section');
                if (container) {
                    const items = container.querySelectorAll('.pvs-list__paged-list-item, .artdeco-list__item');
                    items.forEach(item => {
                        const name = Utils.getTextContent(item.querySelector('.t-bold span[aria-hidden="true"]'));
                        if (name) skills.push(name);
                    });
                }
            }
            return skills;
        },

        /**
         * Extract experience section from profile
         */
        extractExperienceSection: async function () {
            const section = document.querySelector('#experience') || document.querySelector('[data-section="experience"]') || document.querySelector('section.experience');
            if (!section) return [];

            // Reuse scrollToElement and expandSection from LiaDOM
            const DOM = window.LiaDOM;
            if (DOM && DOM.scrollToElement) await DOM.scrollToElement(section);

            const sectionContainer = section.closest('section');
            if (!sectionContainer) return [];

            if (DOM && DOM.expandSection) await DOM.expandSection(sectionContainer);

            const experiences = [];
            const items = sectionContainer.querySelectorAll('.artdeco-list__item, li.pvs-list__paged-list-item');
            const processedElements = new Set();

            for (const item of items) {
                if (processedElements.has(item)) continue;
                try {
                    const subItems = item.querySelectorAll('.pvs-entity__sub-components li');
                    if (subItems.length > 0) {
                        subItems.forEach(sub => processedElements.add(sub));
                        const companyEl = item.querySelector('.t-bold span[aria-hidden="true"]');
                        const companyName = Utils.getTextContent(companyEl);
                        const companyLogo = item.querySelector('img')?.src || null;
                        const companyUrl = item.querySelector('a[href*="/company/"]')?.href || null;

                        for (const subItem of subItems) {
                            const roleTitle = Utils.getTextContent(subItem.querySelector('.t-bold span[aria-hidden="true"]') || subItem.querySelector('.mr1 span[aria-hidden="true"]'));
                            experiences.push({ companyName, companyUrl, companyLogo, roleTitle });
                        }
                    } else {
                        const roleTitle = Utils.getTextContent(item.querySelector('.t-bold span[aria-hidden="true"]'));
                        experiences.push({ roleTitle });
                    }
                } catch (e) { }
            }
            return experiences;
        },

        /**
         * Extract full current profile data
         */
        extractCurrentProfile: async function () {
            const url = window.location.href;
            if (!url.includes('/in/')) return null;
            const username = Utils.parseLinkedInUrl(url);
            if (!username) return null;

            console.log(`[Lia 360] Extracting robust profile data for ${username}...`);
            window.scrollTo(0, 0);
            await Utils.sleep(500);

            const fullName = Utils.getTextContent(document.querySelector('h1')) ||
                Utils.getTextContent(document.querySelector('.text-heading-xlarge')) ||
                Utils.getTextContent(document.querySelector('.top-card-layout__title')) ||
                Utils.formatUsernameAsName(username);

            const headline = Utils.getTextContent(document.querySelector('.text-body-medium.break-words')) ||
                Utils.getTextContent(document.querySelector('.top-card-layout__headline')) ||
                Utils.getTextContent(document.querySelector('[data-generated-suggestion-target*="headline"]')) ||
                Utils.getTextContent(document.querySelector('.pv-text-details__left-panel .text-body-medium'));

            const location = Utils.getTextContent(document.querySelector('.text-body-small.inline.t-black--light.break-words')) ||
                Utils.getTextContent(document.querySelector('.pv-text-details__left-panel .text-body-small')) ||
                Utils.getTextContent(document.querySelector('.top-card-layout__first-subline span:first-child')) ||
                Utils.getTextContent(document.querySelector('.top-card__subline-item:first-child'));

            const avatarUrl = document.querySelector('.pv-top-card-profile-picture__image')?.src ||
                document.querySelector('.profile-photo-edit__preview')?.src ||
                document.querySelector('img[class*="pv-top-card"]')?.src || null;

            const aboutSection = document.querySelector('#about ~ .display-flex .pv-shared-text-with-see-more') ||
                document.querySelector('#about ~ div[class*="full-width"] .pv-shared-text-with-see-more') ||
                document.querySelector('[data-section="about"]') ||
                document.querySelector('section.about .about-section__content') ||
                document.querySelector('.about-section .core-section-container__content');
            const bio = Utils.getTextContent(aboutSection) || headline;

            let company = null;
            let currentPosition = null;
            const experienceSection = document.querySelector('#experience') || document.querySelector('[data-section="experience"]') || document.querySelector('section.experience');

            if (experienceSection) {
                const experienceContainer = experienceSection.closest('section');
                if (experienceContainer) {
                    const firstExperience = experienceContainer.querySelector('.artdeco-list__item, li[class*="experience"]');
                    if (firstExperience) {
                        const tBoldElements = firstExperience.querySelectorAll('.t-bold span[aria-hidden="true"]');
                        if (tBoldElements.length >= 2) {
                            currentPosition = Utils.getTextContent(tBoldElements[0]);
                            company = Utils.getTextContent(tBoldElements[1]);
                        } else if (tBoldElements.length === 1) {
                            const text = Utils.getTextContent(tBoldElements[0]);
                            if (text) {
                                currentPosition = text;
                                const secondaryText = Utils.getTextContent(firstExperience.querySelector('.t-14.t-normal span[aria-hidden="true"]'));
                                company = secondaryText ? secondaryText.split('·')[0].trim() : null;
                            }
                        }
                    }
                }
            }

            if (!company && headline) {
                const atMatch = headline.match(/(?:at|@|em|na)\s+(.+?)(?:\s*[|·•]|$)/i);
                if (atMatch) company = atMatch[1].trim();
            }

            let connectionCount = 0;
            let followersCount = 0;

            let retries = 0;
            const maxRetries = 6;

            while (retries < maxRetries) {
                const stats = this.getQuickStats();
                if (stats && stats.followers && stats.followers !== 'N/A') {
                    followersCount = Utils.parseMetricCount(stats.followers);
                    console.log(`[Lia 360] Stats found via polling on retry ${retries}: ${followersCount}`);
                    break;
                }
                if (retries < maxRetries - 1) {
                    await Utils.sleep(500);
                }
                retries++;
            }

            const topCard = document.querySelector('.top-card-layout') || document.querySelector('.pv-top-card');
            if (topCard) {
                const candidates = Array.from(topCard.querySelectorAll('span, a, .t-bold, .text-body-small'));
                for (const el of candidates) {
                    const text = Utils.getTextContent(el);
                    if (!text) continue;
                    const lowerText = text.toLowerCase();

                    if (lowerText.includes('connect') || lowerText.includes('conex')) {
                        const match = text.match(/([\d,.]+)/);
                        if (match) {
                            const val = Utils.parseMetricCount(match[1]);
                            const isPlus = text.includes('+');
                            const finalVal = isPlus && val === 500 ? 500 : val;
                            if (finalVal > connectionCount) connectionCount = finalVal;
                        }
                    }
                }
            }

            if (followersCount > 0 && connectionCount === 0) {
                connectionCount = followersCount;
            }

            if (followersCount === 0) {
                const activitySection = document.querySelector('#content_collections') || document.querySelector('.pv-recent-activity-detail__feed-container');
                if (activitySection) {
                    const followerText = Utils.getTextContent(activitySection.querySelector('.pvs-header__subtitle'));
                    if (followerText && (followerText.includes('follower') || followerText.includes('seguid'))) {
                        followersCount = Utils.parseMetricCount(followerText);
                    }
                }
            }

            if (followersCount === 0 && connectionCount > 0) followersCount = connectionCount;
            if (connectionCount === 0 && followersCount > 0) connectionCount = followersCount > 500 ? 500 : followersCount;

            const industry = Utils.getTextContent(document.querySelector('.pv-text-details__left-panel span[class*="industry"]'));

            let jobTitle = currentPosition;
            if (!jobTitle && headline) {
                const parts = headline.split(/[|•·]/);
                jobTitle = parts[0].trim();
            }

            let address = null;
            if (location) {
                const parts = location.split(',').map(s => s.trim());
                if (parts.length >= 3) {
                    address = {
                        city: parts[0],
                        state: parts[1],
                        country: Utils.getCountryCode(parts[parts.length - 1])
                    };
                } else if (parts.length === 2) {
                    const code = Utils.getCountryCode(parts[1]);
                    if (code) {
                        address = { city: parts[0], country: code };
                    } else {
                        address = { city: parts[0], state: parts[1], country: 'BR' };
                    }
                } else {
                    address = { city: location, country: 'BR' };
                }
            }

            const contactInfo = await this.extractContactInfo();
            const experiences = await this.extractExperienceSection();

            const education = [];
            const eduSection = document.querySelector('#education') || document.querySelector('[data-section="education"]');
            if (eduSection) {
                const eduContainer = eduSection.closest('section');
                if (eduContainer) {
                    const DOM = window.LiaDOM;
                    if (DOM && DOM.expandSection) await DOM.expandSection(eduContainer);
                    const items = eduContainer.querySelectorAll('.pvs-list__paged-list-item, .artdeco-list__item');
                    items.forEach(item => {
                        try {
                            const school = Utils.getTextContent(item.querySelector('.t-bold span[aria-hidden="true"]'));
                            const degree = Utils.getTextContent(item.querySelector('.t-14.t-normal span[aria-hidden="true"]'));
                            if (school) education.push({ school, degree });
                        } catch (e) { }
                    });
                }
            }

            const skills = await this.extractSkills();

            return {
                username,
                fullName,
                profileUrl: `https://linkedin.com/in/${username}`,
                headline,
                bio: bio || headline,
                location,
                avatarUrl,
                company,
                industry,
                connectionCount,
                followersCount,
                followingCount: connectionCount,
                postsCount: 0,
                posts: [],
                jobTitle,
                address,
                email: contactInfo.email,
                phone: contactInfo.phone,
                website: contactInfo.website,
                twitter: contactInfo.twitter,
                birthday: contactInfo.birthday,
                experiences,
                education,
                skills
            };
        },

        /**
         * Extract lead data from a connection card element
         */
<<<<<<< HEAD
        extractLeadFromCard: function (card) {
=======
        extractLeadFromCard: function(card) {
>>>>>>> origin/main
            try {
                const linkEl = card.querySelector('a[href*="/in/"]');
                if (!linkEl) return null;

                const profileUrl = linkEl.href?.split('?')[0];
                const username = Utils.parseLinkedInUrl(profileUrl);
                if (!username) return null;

<<<<<<< HEAD
                const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"], .mn-connection-card__name, .entity-result__title-text');
                let fullName = Utils.getTextContent(nameEl) || Utils.formatUsernameAsName(username);

                // Cleanup: Remove "View profile" pollution if present (common in entity-result__title-text)
                if (fullName) {
                    fullName = fullName.replace(/View profile|Visualizar perfil|See full profile|Ver perfil completo/gi, '').trim();
                }
=======
                const nameEl = card.querySelector('.entity-result__title-text, .mn-connection-card__name, span[aria-hidden="true"]');
                const fullName = Utils.getTextContent(nameEl) || Utils.formatUsernameAsName(username);
>>>>>>> origin/main

                const headlineEl = card.querySelector('.entity-result__primary-subtitle, .mn-connection-card__occupation');
                const headline = Utils.getTextContent(headlineEl) || '';

                const locationEl = card.querySelector('.entity-result__secondary-subtitle, .mn-connection-card__location');
                const location = Utils.getTextContent(locationEl) || '';

                const avatarEl = card.querySelector('img.ivm-image, .mn-connection-card__picture, img');
                const avatarUrl = avatarEl?.src || null;

                return {
                    username,
                    fullName,
                    profileUrl,
                    headline,
                    location,
                    avatarUrl,
                    connectionCount: 0,
                    followersCount: 0,
                };
            } catch (e) {
                console.warn('[Lia 360] Error extracting from card:', e);
                return null;
            }
        },

        /**
         * Fetch activity page HTML
         */
        fetchActivityPage: async function (username) {
            try {
                const url = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
                const response = await fetch(url);
                if (!response.ok) return null;
                const text = await response.text();
                const parser = new DOMParser();
                return parser.parseFromString(text, 'text/html');
            } catch (e) {
                return null;
            }
        },

        /**
         * Parse recent activity from document
         */
        parseRecentActivity: function (doc) {
            if (!doc) return [];
            const posts = [];
            const postElements = doc.querySelectorAll('.profile-creator-shared-feed-update__container, .feed-shared-update-v2, .occludable-update, li.activity-results__list-item');

            postElements.forEach(postEl => {
                const textEl = postEl.querySelector('.feed-shared-update-v2__description, .update-components-text, .feed-shared-text-view, .commentary');
                const text = Utils.getTextContent(textEl);
                posts.push({ content: text, platform: 'linkedin' });
            });
            return posts.slice(0, 5);
        }
    };

    console.log('[Lia 360] Extractors module loaded');
})();
