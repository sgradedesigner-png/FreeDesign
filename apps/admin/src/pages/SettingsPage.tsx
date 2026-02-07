import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, User, Bell, Shield, Globe } from 'lucide-react';

export default function SettingsPage() {
  const { t, language, toggleLanguage } = useLanguage();
  const [storeName, setStoreName] = useState('E-commerce Admin');
  const [currency, setCurrency] = useState('MNT');
  const [timezone, setTimezone] = useState('Asia/Ulaanbaatar');

  const handleSaveGeneral = () => {
    // TODO: Implement actual save logic
    toast.success(language === 'en' ? 'Settings saved successfully' : 'Тохиргоо амжилттай хадгалагдлаа');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.settings')}</h1>
        <p className="text-muted-foreground mt-1">
          {language === 'en'
            ? 'Manage your store settings and preferences'
            : 'Дэлгүүрийн тохиргоо болон сонголтуудыг удирдах'}
        </p>
      </div>

      <Separator />

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {language === 'en' ? 'General Settings' : 'Ерөнхий тохиргоо'}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Basic store configuration and preferences'
              : 'Дэлгүүрийн үндсэн тохиргоо'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">
              {language === 'en' ? 'Store Name' : 'Дэлгүүрийн нэр'}
            </Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder={language === 'en' ? 'Enter store name' : 'Дэлгүүрийн нэрээ оруулна уу'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">
                {language === 'en' ? 'Currency' : 'Мөнгөн тэмдэгт'}
              </Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="MNT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">
                {language === 'en' ? 'Timezone' : 'Цагийн бүс'}
              </Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Ulaanbaatar"
              />
            </div>
          </div>

          <Button onClick={handleSaveGeneral}>
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {language === 'en' ? 'Language & Region' : 'Хэл ба бүс нутаг'}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Choose your preferred language'
              : 'Өөрийн хэлээ сонгоно уу'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{language === 'en' ? 'Interface Language' : 'Интерфейсийн хэл'}</Label>
              <p className="text-sm text-muted-foreground">
                {language === 'en' ? 'Current: English' : 'Одоогийн: Монгол'}
              </p>
            </div>
            <Button variant="outline" onClick={toggleLanguage}>
              {language === 'en' ? 'Switch to Mongolian' : 'English руу шилжих'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {language === 'en' ? 'Account Settings' : 'Хэрэглэгчийн тохиргоо'}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Manage your account information'
              : 'Хэрэглэгчийн мэдээллээ удирдах'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {language === 'en'
              ? 'Account management features coming soon...'
              : 'Хэрэглэгчийн удирдлагын функцууд удахгүй...'}
          </p>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {language === 'en' ? 'Notifications' : 'Мэдэгдэл'}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Configure notification preferences'
              : 'Мэдэгдлийн тохиргоог өөрчлөх'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {language === 'en'
              ? 'Notification settings coming soon...'
              : 'Мэдэгдлийн тохиргоо удахгүй...'}
          </p>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {language === 'en' ? 'Security' : 'Аюулгүй байдал'}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Manage security and authentication settings'
              : 'Аюулгүй байдал болон нэвтрэх тохиргоо'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {language === 'en'
              ? 'Security features including 2FA will be available soon...'
              : '2FA зэрэг аюулгүй байдлын функцууд удахгүй...'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
