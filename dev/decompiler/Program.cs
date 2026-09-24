using UELib;
using UELib.Core;
var package = UnrealLoader.LoadPackage(args[0]);
// Register types before lazy IndexToObject; otherwise native Class imports are UnknownObject.
package.InitializePackage(UnrealPackage.InitFlags.RegisterClasses);
var output = args.Length > 2 && args[1] == "--out" ? args[2] : null;
if(output != null) Directory.CreateDirectory(output);
foreach (var value in args.Skip(output == null ? 1 : 3)) {
    var obj = package.IndexToObject<UObject>(int.Parse(value));
    obj.BeginDeserializing();
    if(obj is UStruct meta) {
        var first=(UField?)typeof(UStruct).GetProperty("Children",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic)?.GetValue(meta);
        var fields=new List<string>();
        for(var f=first;f!=null;f=f.NextField){f.BeginDeserializing();fields.Add(f.GetPath()+" : "+f.Decompile());}
        if(output!=null)File.WriteAllText(Path.Combine(output,value+".fields.json"),System.Text.Json.JsonSerializer.Serialize(fields));
    }
    Console.WriteLine("// EXPORT " + value + " " + obj.GetPath());
    var source = obj.Decompile();
    if(output == null) Console.WriteLine(source);
    else {
        File.WriteAllText(Path.Combine(output, value + ".uc"), source);
        if(obj is UStruct st && st.ByteCodeManager != null) {
            var tokens = st.ByteCodeManager.DeserializedTokens.Select(t => new {
                type=t.GetType().Name, pos=t.Position, disk=t.StoragePosition,
                size=t.Size, diskSize=t.StorageSize, op=t.OpCode,
                jump=t is UStruct.UByteCodeDecompiler.JumpToken jt ? (int?)jt.CodeOffset : null
            });
            File.WriteAllText(Path.Combine(output,value+".tokens.json"),System.Text.Json.JsonSerializer.Serialize(tokens));
        }
    }
}
