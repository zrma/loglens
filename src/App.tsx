import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function App() {
  const [logFile, setLogFile] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("raw");

  // 로그 파일 선택 함수
  async function selectLogFile() {
    try {
      console.log("파일 선택 시작");
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Log Files",
          extensions: ["log", "txt"]
        }],
        // Tauri v2에서는 권한 관련 설정 추가
        defaultPath: "~/",
        directory: false
      });

      console.log("선택된 파일:", selected);

      if (selected && !Array.isArray(selected)) {
        setLogFile(selected);
        console.log("파일 읽기 시작:", selected);
        try {
          const content = await readTextFile(selected);
          console.log("파일 읽기 완료");
          setLogContent(content);
          setLogLines(content.split("\n").filter(line => line.trim() !== ""));
        } catch (readError) {
          console.error("파일 읽기 오류:", readError);
        }
      }
    } catch (error) {
      console.error("파일 선택 오류:", error);
    }
  }

  // 검색어로 필터링된 로그 라인
  const filteredLogLines = logLines.filter((line: string) =>
    line.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 시간별 로그 개수 데이터 (예시)
  const getChartData = () => {
    // 실제 구현에서는 로그 파일의 타임스탬프를 파싱하여 시간별 로그 개수를 계산
    // 여기서는 간단한 예시 데이터만 반환
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}시`,
      count: Math.floor(Math.random() * 50) + 10
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>LogLens</CardTitle>
          <CardDescription>로컬 로그 파일 분석 도구</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={selectLogFile}>로그 파일 선택</Button>
            {logFile && <p className="text-sm text-muted-foreground">{logFile}</p>}
          </div>

          {logFile && (
            <div className="mt-2">
              <div className="mb-4">
                <Input
                  placeholder="로그 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="raw">원본 로그</TabsTrigger>
                  <TabsTrigger value="analytics">분석</TabsTrigger>
                </TabsList>

                <TabsContent value="raw" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>로그 내용</CardTitle>
                      <CardDescription>
                        총 {filteredLogLines.length}개 라인 {searchTerm && `(검색어: "${searchTerm}")`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[500px] rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">번호</TableHead>
                              <TableHead>내용</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLogLines.map((line, index) => (
                              <TableRow key={index}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-mono">{line}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>시간별 로그 발생 빈도</CardTitle>
                      <CardDescription>24시간 동안의 로그 발생 빈도를 보여줍니다</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={getChartData()}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="count"
                              name="로그 개수"
                              stroke="#8884d8"
                              activeDot={{ r: 8 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
