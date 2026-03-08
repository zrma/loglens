import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type ChartPoint = {
  hour: string;
  count: number;
};

function parseLogTimestamp(line: string): Date | null {
  const isoLikeMatch = line.match(
    /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/,
  );

  if (isoLikeMatch) {
    const normalized = isoLikeMatch[0].includes("T")
      ? isoLikeMatch[0]
      : isoLikeMatch[0].replace(" ", "T");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const slashSeparatedMatch = line.match(/\b\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\b/);

  if (slashSeparatedMatch) {
    const normalized = slashSeparatedMatch[0].replace(/\//g, "-").replace(" ", "T");
    const parsed = new Date(normalized);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function buildHourlyChartData(lines: string[]) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}시`,
    count: 0,
  }));

  let parsedLineCount = 0;

  for (const line of lines) {
    const parsedTimestamp = parseLogTimestamp(line);

    if (!parsedTimestamp) {
      continue;
    }

    counts[parsedTimestamp.getHours()].count += 1;
    parsedLineCount += 1;
  }

  return {
    data: counts satisfies ChartPoint[],
    parsedLineCount,
  };
}

function App() {
  const [logFile, setLogFile] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("raw");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function selectLogFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Log Files",
          extensions: ["log", "txt"]
        }],
        defaultPath: "~/",
        directory: false
      });

      if (selected && !Array.isArray(selected)) {
        setLogFile(selected);

        try {
          await invoke("allow_file_access", { path: selected });
          const content = await readTextFile(selected);
          setErrorMessage(null);
          setLogLines(content.split("\n").filter(line => line.trim() !== ""));
        } catch (readError) {
          setErrorMessage(readError instanceof Error ? readError.message : "로그 파일을 읽지 못했습니다.");
          setLogLines([]);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "로그 파일 선택 중 오류가 발생했습니다.");
    }
  }

  const filteredLogLines = logLines.filter((line: string) =>
    line.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = buildHourlyChartData(filteredLogLines);

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
          {errorMessage && (
            <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
          )}

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
                        {filteredLogLines.length > 0 ? (
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
                        ) : (
                          <div className="p-6 text-sm text-muted-foreground">
                            조건에 맞는 로그 라인이 없습니다.
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>시간별 로그 발생 빈도</CardTitle>
                      <CardDescription>
                        파싱된 {chartData.parsedLineCount}개 로그 라인의 시간대 분포를 보여줍니다
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px]">
                        {chartData.parsedLineCount > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={chartData.data}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="hour" />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="count"
                                name="로그 개수"
                                stroke="#8884d8"
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                            인식 가능한 타임스탬프가 없어 시간대 분석을 표시할 수 없습니다.
                          </div>
                        )}
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
