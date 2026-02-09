import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Send, CheckCircle, XCircle } from 'lucide-react';

export default function EmailTestPage() {
  const [email, setEmail] = useState('mongoldesignner@gmail.com');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{
    type: string;
    success: boolean;
    message: string;
    messageId?: string;
  }[]>([]);

  const sendTestEmail = async (type: 'basic' | 'order-confirmation' | 'expiration-warning') => {
    if (!email) {
      toast.error('И-мэйл хаяг оруулна уу');
      return;
    }

    setLoading(true);
    try {
      let endpoint = '/admin/test-email';
      let typeName = 'Энгийн тест';

      if (type === 'order-confirmation') {
        endpoint = '/admin/test-email/order-confirmation';
        typeName = 'Захиалга баталгаажуулах';
      } else if (type === 'expiration-warning') {
        endpoint = '/admin/test-email/expiration-warning';
        typeName = 'Хугацаа дуусах анхааруулга';
      }

      const response = await api.post(endpoint, { to: email });

      if (response.data.success) {
        toast.success(`${typeName} мэйл амжилттай илгээгдлээ!`);
        setTestResults(prev => [...prev, {
          type: typeName,
          success: true,
          message: response.data.message,
          messageId: response.data.messageId
        }]);
      } else {
        toast.error(`Алдаа: ${response.data.error}`);
        setTestResults(prev => [...prev, {
          type: typeName,
          success: false,
          message: response.data.error
        }]);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(`Алдаа гарлаа: ${errorMsg}`);
      setTestResults(prev => [...prev, {
        type: 'Error',
        success: false,
        message: errorMsg
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Mail className="h-8 w-8" />
            Email систем тест
          </h1>
          <p className="text-muted-foreground">
            Resend API болон support@korean-goods.com хаягийг тестлэх
          </p>
        </div>

        {/* Test Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Тест мэйл илгээх</CardTitle>
            <CardDescription>
              Өөрийн и-мэйл хаяг руу тест мэйл илгээж шалгана уу
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">И-мэйл хаяг</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={() => sendTestEmail('basic')}
                disabled={loading}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? 'Илгээж байна...' : 'Энгийн тест'}
              </Button>

              <Button
                onClick={() => sendTestEmail('order-confirmation')}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Захиалга баталгаажуулах
              </Button>

              <Button
                onClick={() => sendTestEmail('expiration-warning')}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Хугацаа дуусах анхааруулга
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Тестийн үр дүн</CardTitle>
              <CardDescription>
                {testResults.filter(r => r.success).length} / {testResults.length} амжилттай
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20'
                        : 'bg-red-50 border-red-200 dark:bg-red-950/20'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{result.type}</p>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.messageId && (
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          ID: {result.messageId}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-400">📋 Зааварчилгаа</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-blue-900 dark:text-blue-400">
            <ol className="list-decimal list-inside space-y-1">
              <li>Өөрийн и-мэйл хаягаа оруулна уу</li>
              <li>Тест товчуудын аль нэгийг дарна уу</li>
              <li>И-мэйл inbox-оо шалгана уу (spam folder-ийг мартуузай)</li>
              <li>Resend dashboard (https://resend.com/emails) дээр мөн шалгаж болно</li>
            </ol>
          </CardContent>
        </Card>

        {/* Configuration Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Тохиргоо</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="font-medium">API Provider:</div>
              <div className="font-mono">Resend</div>

              <div className="font-medium">From Email:</div>
              <div className="font-mono">support@korean-goods.com</div>

              <div className="font-medium">From Name:</div>
              <div>Korean Goods Support</div>

              <div className="font-medium">DNS Provider:</div>
              <div>Cloudflare</div>

              <div className="font-medium">Mail Server:</div>
              <div>Zoho Mail</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
