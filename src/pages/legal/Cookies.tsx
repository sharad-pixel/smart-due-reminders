import MarketingLayout from '@/components/MarketingLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { COMPANY_INFO } from '@/lib/companyConfig';
import { Shield, Cog, BarChart3, Target, Settings } from 'lucide-react';
import { useCookieConsentContext } from '@/components/CookieConsentProvider';

const cookieCategories = [
  {
    name: 'Strictly Necessary',
    icon: Shield,
    description: 'Essential for the website to function. Cannot be disabled.',
    cookies: [
      { name: 'recouply_cookie_consent', purpose: 'Stores your cookie preferences', duration: 'Persistent', type: 'First-party' },
      { name: 'supabase-auth-token', purpose: 'User authentication session', duration: 'Session', type: 'First-party' },
    ],
  },
  {
    name: 'Functional',
    icon: Cog,
    description: 'Enable enhanced functionality and personalization.',
    cookies: [
      { name: 'theme_preference', purpose: 'Stores your theme preference (light/dark)', duration: '1 year', type: 'First-party' },
      { name: 'sidebar_state', purpose: 'Remembers sidebar collapse state', duration: 'Persistent', type: 'First-party' },
    ],
  },
  {
    name: 'Analytics',
    icon: BarChart3,
    description: 'Help us understand how visitors use our website.',
    cookies: [
      { name: '_ga', purpose: 'Google Analytics - distinguishes users', duration: '2 years', type: 'Third-party' },
      { name: '_gid', purpose: 'Google Analytics - distinguishes users', duration: '24 hours', type: 'Third-party' },
    ],
  },
  {
    name: 'Marketing',
    icon: Target,
    description: 'Used for advertising and tracking across websites.',
    cookies: [
      { name: '_fbp', purpose: 'Facebook Pixel - tracks visits', duration: '3 months', type: 'Third-party' },
      { name: '_gcl_au', purpose: 'Google Ads conversion tracking', duration: '3 months', type: 'Third-party' },
    ],
  },
];

export default function Cookies() {
  const { openPreferences, preferences } = useCookieConsentContext();
  const currentYear = new Date().getFullYear();

  return (
    <MarketingLayout>
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Cookie Policy
          </h1>
          <p className="text-lg text-muted-foreground">
            Last updated: December {currentYear}
          </p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">What Are Cookies?</h2>
            <p className="text-muted-foreground">
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. 
              They are widely used to make websites work more efficiently and provide information to website owners. 
              Cookies help us provide you with a better experience by enabling us to recognize you when you return to our site, 
              remember your preferences, and understand how you use our services.
            </p>
          </section>

          {/* Your Choices */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Your Cookie Choices</h2>
            <p className="text-muted-foreground mb-4">
              You have the right to decide whether to accept or reject cookies. You can manage your cookie preferences 
              at any time using the button below or through your browser settings.
            </p>
            <Button onClick={openPreferences} className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Cookie Preferences
            </Button>
            {preferences && (
              <p className="text-sm text-muted-foreground mt-2">
                Your preferences were last updated: {new Date(preferences.timestamp).toLocaleDateString()}
              </p>
            )}
          </section>

          {/* Cookie Categories */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-6">Types of Cookies We Use</h2>
            <div className="space-y-6">
              {cookieCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Card key={category.name}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {category.name} Cookies
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">{category.description}</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cookie Name</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {category.cookies.map((cookie) => (
                            <TableRow key={cookie.name}>
                              <TableCell className="font-mono text-sm">{cookie.name}</TableCell>
                              <TableCell>{cookie.purpose}</TableCell>
                              <TableCell>{cookie.duration}</TableCell>
                              <TableCell>{cookie.type}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* How to Control Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">How to Control Cookies in Your Browser</h2>
            <p className="text-muted-foreground mb-4">
              Most web browsers allow you to control cookies through their settings. Here are links to manage cookies 
              in popular browsers:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google Chrome
                </a>
              </li>
              <li>
                <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Safari
                </a>
              </li>
              <li>
                <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Microsoft Edge
                </a>
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Please note that restricting cookies may impact your experience on our website, as some features may not 
              function properly without certain cookies.
            </p>
          </section>

          {/* Third-Party Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Cookies</h2>
            <p className="text-muted-foreground">
              Some cookies on our website are set by third-party services that appear on our pages. We do not control 
              the setting of these cookies, so we suggest you check the third-party websites for more information about 
              their cookies and how to manage them. Third-party services we use may include Google Analytics, Facebook, 
              and other advertising and analytics providers.
            </p>
          </section>

          {/* Updates to Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to This Cookie Policy</h2>
            <p className="text-muted-foreground">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, 
              or our data practices. When we make changes, we will update the "Last updated" date at the top of this page. 
              We encourage you to periodically review this page for the latest information on our cookie practices.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about our use of cookies or this Cookie Policy, please contact us at:
            </p>
            <address className="not-italic mt-4 text-muted-foreground">
              <strong className="text-foreground">{COMPANY_INFO.legalName}</strong><br />
              Email: <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">{COMPANY_INFO.emails.support}</a><br />
              {COMPANY_INFO.address.full}
            </address>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
